import { createServerClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push/send";
import { COMFY_BASES, cleanupComfyJob, deleteComfyOutput } from "@/lib/comfyui/client";

export async function finalizeImageJob(jobId: string, imageData: Buffer | string) {
  const supabase = createServerClient();
  const fileName = `${jobId}.jpg`;

  // imageData pode ser Buffer (RunPod base64 decodificado) ou URL (ComfyUI direto)
  let buffer: Buffer;
  if (typeof imageData === "string") {
    const res = await fetch(imageData);
    if (!res.ok) throw new Error(`Falha ao baixar imagem do ComfyUI: ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
  } else {
    buffer = imageData;
  }

  const { error: uploadError } = await supabase.storage
    .from("image-jobs")
    .upload(fileName, buffer, { contentType: "image/jpeg", upsert: true });

  if (uploadError) throw uploadError;

  // URL pública permanente — sem expiração
  const { data: publicData } = supabase.storage
    .from("image-jobs")
    .getPublicUrl(fileName);

  const outputUrl = publicData.publicUrl;

  // Busca dados do job para montar notificação personalizada
  const { data: job } = await supabase
    .from("image_jobs")
    .select("user_id, prompt")
    .eq("id", jobId)
    .single();

  await supabase
    .from("image_jobs")
    .update({ status: "done", output_image_url: outputUrl })
    .eq("id", jobId);

  // Limpa inputs + histórico do ComfyUI e deleta output do workspace (libera disco)
  cleanupComfyJob(jobId, COMFY_BASES[0]).catch(() => {});
  deleteComfyOutput(jobId, COMFY_BASES[0]).catch(() => {});

  // Dispara push notification
  if (job?.user_id) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", job.user_id);

    if (subs && subs.length > 0) {
      const product = (job.prompt ?? "").split(" | cenário:")[0]?.trim();
      const title = product ? `Foto de ${product} pronta! ✨` : "Sua foto ficou pronta! ✨";
      await sendPushToUser(subs, title, "Toque para ver o resultado.");
    }
  }
}
