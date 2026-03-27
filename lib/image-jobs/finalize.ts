import { createServerClient } from "@/lib/supabase/server";

export async function finalizeImageJob(jobId: string, imageUrl: string) {
  const supabase = createServerClient();

  // Baixar imagem do servidor externo
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) throw new Error("Falha ao baixar imagem do provedor");

  const buffer = await imageRes.arrayBuffer();
  const fileName = `${jobId}.jpg`;

  // Salvar no Supabase Storage (bucket privado)
  const { error: uploadError } = await supabase.storage
    .from("image-jobs")
    .upload(fileName, buffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  // Gerar URL assinada (1 hora)
  const { data: signedData, error: signError } = await supabase.storage
    .from("image-jobs")
    .createSignedUrl(fileName, 3600);

  if (signError || !signedData) throw signError ?? new Error("URL assinada falhou");

  // Atualizar job como done
  await supabase
    .from("image_jobs")
    .update({
      status: "done",
      output_image_url: signedData.signedUrl,
    })
    .eq("id", jobId);
}
