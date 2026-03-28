import { createServerClient } from "@/lib/supabase/server";

export async function finalizeVideoJob(jobId: string, videoData: Buffer | string) {
  const supabase = createServerClient();
  const fileName = `${jobId}.mp4`;

  let buffer: Buffer;
  if (typeof videoData === "string") {
    const res = await fetch(videoData);
    if (!res.ok) {
      // Fallback: salva URL direto
      await supabase.from("video_jobs").update({ status: "done", output_video_url: videoData }).eq("id", jobId);
      return;
    }
    buffer = Buffer.from(await res.arrayBuffer());
  } else {
    buffer = videoData;
  }

  const { error: uploadError } = await supabase.storage
    .from("video-jobs")
    .upload(fileName, buffer, { contentType: "video/mp4", upsert: true });

  if (uploadError) throw uploadError;

  const { data: signed } = await supabase.storage
    .from("video-jobs")
    .createSignedUrl(fileName, 7 * 24 * 3600);

  if (signed?.signedUrl) {
    await supabase.from("video_jobs").update({ status: "done", output_video_url: signed.signedUrl }).eq("id", jobId);
    return;
  }

  throw new Error("Falha ao gerar URL assinada do vídeo");
}
