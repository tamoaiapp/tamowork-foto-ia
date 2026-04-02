// index.js — Cloud Run Function (entrypoint: helloHttp)
// Rotas: GET /health, GET /metrics, POST /enqueue, GET /job/:id
//        POST /dispatch  ← Cloud Scheduler a cada 30s (pega queued → submete ao ComfyUI)
//        POST /check     ← Cloud Scheduler a cada 30s (checa running → atualiza Firestore)

const express = require("express");
const crypto = require("crypto");
const { Firestore } = require("@google-cloud/firestore");

const app = express();
app.use(express.json({ limit: "25mb" }));

// =======================
// CORS (Bubble)
// =======================
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

const db = new Firestore();

// =======================
// ENV
// =======================
const COLLECTION = process.env.FIRESTORE_COLLECTION || "image_jobs";
const AVG_JOB_SEC = Number(process.env.AVG_JOB_SEC || "70");
const SERVERS_ONLINE = Number(process.env.SERVERS_ONLINE || "1");
const SLOTS_PER_SERVER = Number(process.env.SLOTS_PER_SERVER || "1");
const MAX_GLOBAL_QUEUE = Number(process.env.MAX_GLOBAL_QUEUE || "200");
const JOB_TTL_MINUTES = Number(process.env.JOB_TTL_MINUTES || "60");
const DISPATCH_SECRET = process.env.DISPATCH_SECRET || "tamowork-dispatch-2026";

// ComfyUI — lista de bases separada por vírgula (index 0 = sempre ligado, index 1 = horário comercial)
const COMFY_BASES = (process.env.COMFY_BASES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// =======================
// Workflow template (Qwen Image Edit)
// =======================
const WORKFLOW_TEMPLATE = {
  "1": {
    inputs: { prompt: "", clip: ["33", 0], vae: ["10", 0], image1: ["160", 0] },
    class_type: "TextEncodeQwenImageEditPlus",
  },
  "10": {
    inputs: { vae_name: "qwen_image_vae.safetensors" },
    class_type: "VAELoader",
  },
  "11": {
    inputs: { image: "" },
    class_type: "LoadImage",
  },
  "13": {
    inputs: { samples: ["167", 0], vae: ["10", 0] },
    class_type: "VAEDecode",
  },
  "24": {
    inputs: {
      lora_name: "Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors",
      strength_model: 1,
      model: ["32", 0],
    },
    class_type: "LoraLoaderModelOnly",
  },
  "30": {
    inputs: { shift: 3.1, model: ["24", 0] },
    class_type: "ModelSamplingAuraFlow",
  },
  "32": {
    inputs: {
      unet_name: "qwen_image_edit_2511_fp8mixed.safetensors",
      weight_dtype: "default",
    },
    class_type: "UNETLoader",
  },
  "33": {
    inputs: {
      clip_name: "qwen_2.5_vl_7b_fp8_scaled.safetensors",
      type: "qwen_image",
      device: "default",
    },
    class_type: "CLIPLoader",
  },
  "39": {
    inputs: { prompt: "", clip: ["33", 0], vae: ["10", 0], image1: ["160", 0] },
    class_type: "TextEncodeQwenImageEditPlus",
  },
  "51": {
    inputs: { image_a: ["13", 0], image_b: ["160", 0] },
    class_type: "Image Comparer (rgthree)",
  },
  "119": {
    inputs: { pixels: ["160", 0], vae: ["10", 0] },
    class_type: "VAEEncode",
  },
  "160": {
    inputs: { image: ["11", 0] },
    class_type: "FluxKontextImageScale",
  },
  "166": {
    inputs: { filename_prefix: "", images: ["13", 0] },
    class_type: "SaveImage",
  },
  "167": {
    inputs: {
      seed: 0,
      steps: 8,
      cfg: 1,
      sampler_name: "euler",
      scheduler: "simple",
      denoise: 1,
      model: ["30", 0],
      positive: ["1", 0],
      negative: ["39", 0],
      latent_image: ["119", 0],
    },
    class_type: "KSampler",
  },
};

// =======================
// Helpers
// =======================
function nowMs() {
  return Date.now();
}

function makeJobId() {
  return crypto.randomBytes(12).toString("hex");
}

function clampInt(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  return Math.max(min, Math.min(max, i));
}

function capacity() {
  return Math.max(1, SERVERS_ONLINE * SLOTS_PER_SERVER);
}

function estimateEtaSec(queueCount) {
  return Math.ceil((queueCount / capacity()) * Math.max(1, AVG_JOB_SEC));
}

// Escolhe o índice do ComfyUI (index 0 = sempre, index 1 = horário comercial BRT)
function pickComfyBase() {
  if (COMFY_BASES.length === 0) return { base: null, index: 0 };
  if (COMFY_BASES.length === 1) return { base: COMFY_BASES[0], index: 0 };
  const hourBRT = (new Date().getUTCHours() - 3 + 24) % 24;
  const isBusinessHours = hourBRT >= 8 && hourBRT < 20;
  const index = isBusinessHours ? 1 : 0;
  return { base: COMFY_BASES[index], index };
}

// =======================
// Queue helpers
// =======================
async function getActiveQueueCount() {
  const q = db
    .collection(COLLECTION)
    .where("status", "in", ["queued", "running"]);
  try {
    const agg = await q.count().get();
    return agg.data().count || 0;
  } catch (e) {
    const snap = await q.limit(MAX_GLOBAL_QUEUE + 50).get();
    return snap.size;
  }
}

async function readJob(job_id) {
  const snap = await db.collection(COLLECTION).doc(job_id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

function isExpired(job) {
  const created = Number(job?.createdAt || 0);
  if (!created) return false;
  const ageMs = nowMs() - created;
  return ageMs > JOB_TTL_MINUTES * 60 * 1000 && job?.status !== "done";
}

// =======================
// ComfyUI helpers
// =======================

// Faz download da imagem e sobe para o ComfyUI
async function uploadImageToComfy(imageUrl, comfyBase, jobId) {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Falha ao baixar imagem: ${imgRes.status}`);
  const buffer = await imgRes.arrayBuffer();

  const filename = `product_${jobId.replace(/-/g, "").slice(0, 12)}.jpg`;

  const { FormData, Blob } = await import("node:buffer").catch(() => {
    // Node 18+ tem globais nativas
    return { FormData: global.FormData, Blob: global.Blob };
  });

  const form = new global.FormData();
  const blob = new global.Blob([buffer], { type: "image/jpeg" });
  form.append("image", blob, filename);
  form.append("overwrite", "true");

  const res = await fetch(`${comfyBase}/upload/image`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`ComfyUI upload error: ${res.status}`);
  const data = await res.json();
  return data.name;
}

// Monta e submete o workflow ao ComfyUI
async function submitWorkflow(jobId, imageName, promptPos, promptNeg, comfyBase) {
  const workflow = JSON.parse(JSON.stringify(WORKFLOW_TEMPLATE));
  workflow["11"].inputs.image = imageName;
  workflow["1"].inputs.prompt = `${promptPos}\n#job:${jobId}`;
  workflow["39"].inputs.prompt = promptNeg || "nao mexa no produto";
  workflow["166"].inputs.filename_prefix = `job_${jobId}`;
  workflow["167"].inputs.seed = Math.floor(Math.random() * 999_999_999);

  const res = await fetch(`${comfyBase}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: workflow,
      client_id: `tamoai_${jobId}`,
    }),
  });
  if (!res.ok) throw new Error(`ComfyUI submit error: ${res.status}`);
  const data = await res.json();
  return data.prompt_id;
}

// Checa se o job terminou no ComfyUI
async function getComfyHistory(promptId, comfyBase) {
  const res = await fetch(`${comfyBase}/history/${promptId}`);
  if (!res.ok) return { outputUrl: null, status: "pending" };

  const history = await res.json();
  const entry = history[promptId];
  if (!entry) return { outputUrl: null, status: "pending" };

  const saveOutput = entry.outputs?.["166"];
  if (saveOutput?.images?.length) {
    const img = saveOutput.images[0];
    const outputUrl = `${comfyBase}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${img.type}`;
    return { outputUrl, status: "done" };
  }

  if (entry.status?.status_str === "error") {
    return { outputUrl: null, status: "failed" };
  }

  return { outputUrl: null, status: "pending" };
}

// Verifica se o segredo do dispatch é válido
function checkDispatchSecret(req) {
  const header = req.headers["x-dispatch-secret"] || req.headers["authorization"]?.replace("Bearer ", "");
  return header === DISPATCH_SECRET;
}

// =======================
// Routes existentes
// =======================

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "tamoai-queue-api",
    collection: COLLECTION,
    capacity: capacity(),
    avg_job_sec: AVG_JOB_SEC,
    max_global_queue: MAX_GLOBAL_QUEUE,
    job_ttl_minutes: JOB_TTL_MINUTES,
    comfy_bases: COMFY_BASES.length,
    routes: ["POST /enqueue", "GET /job/:id", "GET /metrics", "GET /health", "POST /dispatch", "POST /check"],
  });
});

app.get("/metrics", async (req, res) => {
  try {
    const active = await getActiveQueueCount();
    const etaSec = estimateEtaSec(active);
    res.json({
      ok: true,
      active_queue: active,
      capacity: capacity(),
      eta_minutes_now: Math.ceil(etaSec / 60),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/enqueue", async (req, res) => {
  try {
    let { image_url, prompt_pos, prompt_neg, width, height, priority, meta } =
      req.body || {};

    if (!image_url) {
      return res.status(400).json({ ok: false, error: "missing_image_url" });
    }

    image_url = String(image_url).trim();
    if (image_url.startsWith("//")) image_url = "https:" + image_url;
    if (!/^https?:\/\//i.test(image_url)) {
      return res.status(400).json({ ok: false, error: "invalid_image_url", got: image_url });
    }

    const active = await getActiveQueueCount();
    if (active >= MAX_GLOBAL_QUEUE) {
      const etaSec = estimateEtaSec(active);
      return res.status(503).json({
        ok: false,
        status: "queue_full",
        active_queue: active,
        eta_minutes: Math.ceil(etaSec / 60),
        message: "Muita demanda agora. Tente novamente em alguns minutos.",
      });
    }

    const w = width != null ? clampInt(width, 256, 4096) : null;
    const h = height != null ? clampInt(height, 256, 4096) : null;
    const job_id = makeJobId();
    const ts = nowMs();
    const queuePos = active + 1;
    const etaSec = estimateEtaSec(queuePos);

    await db.collection(COLLECTION).doc(job_id).set({
      status: "queued",
      createdAt: ts,
      updatedAt: ts,
      image_url: String(image_url),
      prompt_pos: String(prompt_pos || ""),
      prompt_neg: String(prompt_neg || ""),
      width: w,
      height: h,
      attempts: 0,
      priority: Number.isFinite(Number(priority)) ? Number(priority) : 0,
      server_idx: null,
      prompt_id: null,
      result_urls: [],
      outputUrl: null,
      error: null,
      etaSecAtEnqueue: etaSec,
      queuePosAtEnqueue: queuePos,
      meta: meta && typeof meta === "object" ? meta : null,
    });

    return res.json({
      ok: true,
      status: "queued",
      job_id,
      queue_position: queuePos,
      eta_minutes: Math.ceil(etaSec / 60),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/job/:id", async (req, res) => {
  try {
    const job_id = req.params.id;
    const job = await readJob(job_id);

    if (!job) {
      return res.json({ ok: true, status: "not_found", job_id });
    }

    if (isExpired(job) && job.status !== "expired") {
      await db.collection(COLLECTION).doc(job_id).update({
        status: "expired",
        updatedAt: nowMs(),
        error: "expired_ttl",
      });
      return res.json({ ok: true, status: "expired", job_id, error: "expired_ttl" });
    }

    return res.json({
      ok: true,
      job_id,
      status: job.status || "unknown",
      createdAt: job.createdAt || null,
      updatedAt: job.updatedAt || null,
      attempts: job.attempts ?? 0,
      priority: job.priority ?? 0,
      outputUrl: job.outputUrl || null,
      result_urls: Array.isArray(job.result_urls) ? job.result_urls : [],
      error: job.error || null,
      eta_minutes: job.etaSecAtEnqueue ? Math.ceil(job.etaSecAtEnqueue / 60) : null,
      queue_position: job.queuePosAtEnqueue || null,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// =======================
// POST /dispatch
// Chamado pelo Cloud Scheduler a cada 30s
// Pega o próximo job "queued" e submete ao ComfyUI
// =======================
app.post("/dispatch", async (req, res) => {
  if (!checkDispatchSecret(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  if (COMFY_BASES.length === 0) {
    return res.status(503).json({ ok: false, error: "COMFY_BASES não configurado" });
  }

  try {
    // Conta quantos jobs estão "running" — não disparar se já atingiu capacidade
    const runningSnap = await db
      .collection(COLLECTION)
      .where("status", "==", "running")
      .count()
      .get();
    const runningCount = runningSnap.data().count || 0;

    if (runningCount >= capacity()) {
      return res.json({ ok: true, dispatched: 0, reason: "capacity_full", running: runningCount });
    }

    // Pega o próximo job queued (mais antigo primeiro, depois por prioridade)
    const snap = await db
      .collection(COLLECTION)
      .where("status", "==", "queued")
      .orderBy("priority", "desc")
      .orderBy("createdAt", "asc")
      .limit(1)
      .get();

    if (snap.empty) {
      return res.json({ ok: true, dispatched: 0, reason: "queue_empty" });
    }

    const doc = snap.docs[0];
    const job = { id: doc.id, ...doc.data() };

    // Marca como "running" antes de processar (evita duplo dispatch)
    await db.collection(COLLECTION).doc(job.id).update({
      status: "running",
      updatedAt: nowMs(),
      attempts: (job.attempts || 0) + 1,
    });

    const { base: comfyBase, index: serverIdx } = pickComfyBase();

    let imageName, promptId;
    try {
      imageName = await uploadImageToComfy(job.image_url, comfyBase, job.id);
      promptId = await submitWorkflow(
        job.id,
        imageName,
        job.prompt_pos || "",
        job.prompt_neg || "",
        comfyBase
      );
    } catch (err) {
      // Falha no dispatch — volta para queued se primeiras tentativas, senão failed
      const attempts = (job.attempts || 0) + 1;
      if (attempts <= 3) {
        await db.collection(COLLECTION).doc(job.id).update({
          status: "queued",
          updatedAt: nowMs(),
          attempts,
          error: String(err?.message || err),
        });
      } else {
        await db.collection(COLLECTION).doc(job.id).update({
          status: "failed",
          updatedAt: nowMs(),
          attempts,
          error: String(err?.message || err),
        });
      }
      return res.status(500).json({ ok: false, error: String(err?.message || err), job_id: job.id });
    }

    // Salva prompt_id para o /check poder consultar depois
    await db.collection(COLLECTION).doc(job.id).update({
      prompt_id: promptId,
      server_idx: serverIdx,
      updatedAt: nowMs(),
    });

    console.log(`[dispatch] job ${job.id} → ComfyUI ${serverIdx} prompt_id=${promptId}`);

    return res.json({
      ok: true,
      dispatched: 1,
      job_id: job.id,
      prompt_id: promptId,
      server_idx: serverIdx,
    });
  } catch (e) {
    console.error("[dispatch] erro:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// =======================
// POST /check
// Chamado pelo Cloud Scheduler a cada 30s
// Checa todos os jobs "running" no ComfyUI e finaliza os prontos
// =======================
app.post("/check", async (req, res) => {
  if (!checkDispatchSecret(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  try {
    const snap = await db
      .collection(COLLECTION)
      .where("status", "==", "running")
      .limit(20)
      .get();

    if (snap.empty) {
      return res.json({ ok: true, checked: 0, done: 0 });
    }

    let checked = 0;
    let done = 0;
    const errors = [];

    for (const doc of snap.docs) {
      const job = { id: doc.id, ...doc.data() };
      checked++;

      // Timeout: job rodando há mais de JOB_TTL_MINUTES → falha
      if (isExpired(job)) {
        await db.collection(COLLECTION).doc(job.id).update({
          status: "failed",
          updatedAt: nowMs(),
          error: "timeout",
        });
        errors.push(`${job.id}: timeout`);
        continue;
      }

      if (!job.prompt_id) {
        errors.push(`${job.id}: sem prompt_id`);
        continue;
      }

      const serverIdx = job.server_idx ?? 0;
      const comfyBase = COMFY_BASES[serverIdx] ?? COMFY_BASES[0];

      try {
        const result = await getComfyHistory(job.prompt_id, comfyBase);

        if (result.status === "done" && result.outputUrl) {
          await db.collection(COLLECTION).doc(job.id).update({
            status: "done",
            updatedAt: nowMs(),
            outputUrl: result.outputUrl,
            result_urls: [result.outputUrl],
            error: null,
          });
          done++;
          console.log(`[check] job ${job.id} → done: ${result.outputUrl}`);
        } else if (result.status === "failed") {
          const attempts = job.attempts || 1;
          if (attempts <= 2) {
            // Retry: volta para queued
            await db.collection(COLLECTION).doc(job.id).update({
              status: "queued",
              updatedAt: nowMs(),
              prompt_id: null,
              server_idx: null,
              error: "comfyui_failed_retry",
            });
          } else {
            await db.collection(COLLECTION).doc(job.id).update({
              status: "failed",
              updatedAt: nowMs(),
              error: "comfyui_failed",
            });
          }
          errors.push(`${job.id}: comfyui_failed`);
        }
        // "pending" → não faz nada, próximo /check vai verificar de novo
      } catch (err) {
        errors.push(`${job.id}: ${err?.message}`);
      }
    }

    return res.json({ ok: true, checked, done, errors });
  } catch (e) {
    console.error("[check] erro:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ✅ Entry point do Cloud Run Function
exports.helloHttp = app;
