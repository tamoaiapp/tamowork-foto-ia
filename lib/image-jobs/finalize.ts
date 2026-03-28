import { createServerClient } from "@/lib/supabase/server";

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

  const { data: signedData, error: signError } = await supabase.storage
    .from("image-jobs")
    .createSignedUrl(fileName, 7 * 24 * 3600);

  if (signError || !signedData) throw signError ?? new Error("URL assinada falhou");

  await supabase
    .from("image_jobs")
    .update({ status: "done", output_image_url: signedData.signedUrl })
    .eq("id", jobId);
}
