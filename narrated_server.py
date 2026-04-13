#!/usr/bin/env python3
"""
TamoWork - Servidor de Montagem de Vídeo com Narração
Porta: 3002

Como iniciar (JupyterLab terminal no pod de vídeo):
  pip install edge-tts -q
  python /workspace/narrated_server.py

Endpoints:
  GET  /health              → {"ok": true}
  POST /assemble            → inicia montagem em background, retorna {"started": true}
  GET  /status/<job_id>     → {"status": "processing"|"done"|"failed", "video_url": "..."}
"""
import http.server
import json
import os
import subprocess
import sys
import tempfile
import threading
import traceback
import urllib.error
import urllib.request
import uuid

# ── Estado global de jobs em andamento ─────────────────────────────────────────
_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()

# ── Helpers ─────────────────────────────────────────────────────────────────────

def _download(url: str, dest: str, timeout: int = 60):
    req = urllib.request.Request(url, headers={"User-Agent": "TamoWork/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        with open(dest, "wb") as f:
            f.write(r.read())

def _upload_supabase(file_path: str, supabase_url: str, supabase_key: str,
                     bucket: str, object_name: str) -> str:
    with open(file_path, "rb") as f:
        data = f.read()

    url = f"{supabase_url}/storage/v1/object/{bucket}/{object_name}"
    headers = {
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "video/mp4",
        "x-upsert": "true",
    }
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            r.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Supabase upload HTTP {e.code}: {e.read()[:200]}")

    return f"{supabase_url}/storage/v1/object/public/{bucket}/{object_name}"


def _ensure_ffmpeg():
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False


def _ensure_edge_tts():
    try:
        import importlib
        importlib.import_module("edge_tts")
        return True
    except ImportError:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "edge-tts", "-q"],
            capture_output=True, text=True
        )
        return result.returncode == 0


# ── Montagem do vídeo Ken Burns ──────────────────────────────────────────────────

def _assemble_video(job_id: str, scene_urls: list, text: str,
                    supabase_url: str, supabase_key: str) -> str:
    """
    Pipeline:
      1. edge-tts: texto → MP3
      2. Download cenas JPG
      3. ffmpeg zoompan (Ken Burns) + mix áudio → MP4
      4. Upload para Supabase Storage
      5. Retorna URL pública
    """
    with tempfile.TemporaryDirectory() as tmp:
        # 1. TTS
        audio_file = os.path.join(tmp, "narration.mp3")
        tts_cmd = [
            sys.executable, "-m", "edge_tts",
            "--voice", "pt-BR-FranciscaNeural",
            "--text", text,
            "--write-media", audio_file,
        ]
        r = subprocess.run(tts_cmd, capture_output=True, text=True, timeout=60)
        if r.returncode != 0:
            raise RuntimeError(f"edge-tts error: {r.stderr[-500:]}")

        # 2. Download cenas
        scene_files = []
        for i, url in enumerate(scene_urls):
            dest = os.path.join(tmp, f"scene_{i:02d}.jpg")
            try:
                _download(url, dest)
                scene_files.append(dest)
            except Exception as e:
                print(f"[assemble] skip scene {i}: {e}")

        if len(scene_files) < 2:
            raise RuntimeError("Cenas insuficientes para montar o vídeo (mínimo 2)")

        n = len(scene_files)
        per_scene_dur = 4  # segundos por cena
        fps = 25

        # 3. Monta com ffmpeg (Ken Burns: zoompan alternado)
        #    Cada cena = imagem estática → ~100 frames com zoom suave
        output_file = os.path.join(tmp, "output.mp4")

        # Construir filtro complexo: N imagens → zoompan → concat → mix áudio
        filter_parts = []
        concat_inputs = ""

        for i, sf in enumerate(scene_files):
            frames = per_scene_dur * fps
            if i % 2 == 0:
                # zoom in
                z_expr = f"'min(zoom+0.0008,1.35)'"
                x_expr = "'iw/2-(iw/zoom/2)'"
                y_expr = "'ih/2-(ih/zoom/2)'"
            else:
                # zoom out
                z_expr = f"'if(eq(on,1),1.35,max(zoom-0.0008,1.0))'"
                x_expr = "'iw/2-(iw/zoom/2)'"
                y_expr = "'ih/2-(ih/zoom/2)'"

            filter_parts.append(
                f"[{i}:v]"
                f"scale=1280:720:force_original_aspect_ratio=increase,"
                f"crop=1280:720,"
                f"zoompan=z={z_expr}:x={x_expr}:y={y_expr}"
                f":d={frames}:s=1280x720:fps={fps},"
                f"setpts=PTS-STARTPTS"
                f"[v{i}]"
            )
            concat_inputs += f"[v{i}]"

        filter_parts.append(f"{concat_inputs}concat=n={n}:v=1:a=0[vout]")
        full_filter = ";".join(filter_parts)

        # Entradas: N imagens (loop) + 1 áudio
        cmd = ["ffmpeg", "-y"]
        for sf in scene_files:
            cmd += ["-loop", "1", "-t", str(per_scene_dur), "-i", sf]
        cmd += ["-i", audio_file]
        cmd += [
            "-filter_complex", full_filter,
            "-map", "[vout]",
            "-map", f"{n}:a",
            "-c:v", "libx264",
            "-c:a", "aac",
            "-b:a", "128k",
            "-preset", "fast",
            "-crf", "23",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-shortest",
            output_file,
        ]

        print(f"[assemble] ffmpeg cmd: {' '.join(cmd[:20])}...")
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if r.returncode != 0:
            raise RuntimeError(f"ffmpeg error: {r.stderr[-1000:]}")

        # 4. Upload
        object_name = f"narrated/{job_id}.mp4"
        video_url = _upload_supabase(output_file, supabase_url, supabase_key,
                                     "video-jobs", object_name)
        return video_url


def _run_assembly_thread(body: dict):
    job_id = body["job_id"]
    print(f"[assemble] start job={job_id} scenes={len(body.get('scenes', []))}")

    try:
        video_url = _assemble_video(
            job_id=job_id,
            scene_urls=body.get("scenes", []),
            text=body.get("text", ""),
            supabase_url=body.get("supabase_url", ""),
            supabase_key=body.get("supabase_key", ""),
        )
        with _jobs_lock:
            _jobs[job_id] = {"status": "done", "video_url": video_url}
        print(f"[assemble] done job={job_id} url={video_url}")
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[assemble] ERROR job={job_id}: {e}\n{tb}")
        with _jobs_lock:
            _jobs[job_id] = {"status": "failed", "error": str(e)}


# ── HTTP Handler ──────────────────────────────────────────────────────────────────

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[http] {self.address_string()} {fmt % args}")

    def _send_json(self, code: int, data: dict):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {"ok": True, "service": "narrated-video",
                                   "jobs_active": len(_jobs)})
            return

        if self.path.startswith("/status/"):
            job_id = self.path[len("/status/"):]
            with _jobs_lock:
                status = _jobs.get(job_id, {"status": "unknown"})
            self._send_json(200, status)
            return

        self._send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/assemble":
            self._send_json(404, {"error": "not found"})
            return

        length = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(length))
        except Exception:
            self._send_json(400, {"error": "invalid JSON"})
            return

        job_id = body.get("job_id") or str(uuid.uuid4())
        body["job_id"] = job_id

        with _jobs_lock:
            _jobs[job_id] = {"status": "processing"}

        t = threading.Thread(target=_run_assembly_thread, args=(body,), daemon=True)
        t.start()

        self._send_json(200, {"started": True, "job_id": job_id})


# ── Entry point ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Verifica dependências
    if not _ensure_ffmpeg():
        print("[WARN] ffmpeg não encontrado — instale com: apt-get install ffmpeg")
    if not _ensure_edge_tts():
        print("[WARN] edge-tts não instalado — rode: pip install edge-tts")
    else:
        print("[OK] edge-tts disponível")

    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3002
    server = http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"[narrated-video] Servidor rodando na porta {port}")
    print(f"[narrated-video] Acesse: https://edl3f6a18ofxey-{port}.proxy.runpod.net")
    server.serve_forever()
