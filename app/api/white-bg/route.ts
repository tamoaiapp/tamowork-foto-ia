import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createImageJob, RateLimitError } from "@/lib/image-jobs/create";
import path from "path";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { input_image_url, prompt } = body;
  if (!input_image_url) {
    return NextResponse.json({ error: "input_image_url obrigatório" }, { status: 400 });
  }

  try {
    // Dynamic imports — evita falha no carregamento do módulo ONNX em nível de módulo
    const sharp = (await import("sharp")).default;
    const { removeBackground } = await import("@imgly/background-removal-node");

    // 1. Baixa a imagem original
    const imgRes = await fetch(input_image_url);
    if (!imgRes.ok) throw new Error(`Falha ao baixar imagem: ${imgRes.status}`);
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    // 2. Remove o fundo
    // proxyToWorker:false — Web Workers não existem em serverless Node.js (Vercel)
    // publicPath aponta para os arquivos ONNX locais para evitar download do CDN
    const localDist = `file://${path.resolve(process.cwd(), "node_modules/@imgly/background-removal-node/dist")}/`;
    const noBgBlob = await removeBackground(new Blob([imgBuffer]), {
      proxyToWorker: false,
      publicPath: localDist,
    });
    const noBgBuffer = Buffer.from(await noBgBlob.arrayBuffer());

    // 3. Compõe sobre fundo branco com sharp
    const { width, height } = await sharp(noBgBuffer).metadata();
    const finalBuffer = await sharp({
      create: {
        width: width!,
        height: height!,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([{ input: noBgBuffer, blend: "over" }])
      .jpeg({ quality: 92 })
      .toBuffer();

    // 4. Sobe para o Supabase Storage como resultado
    const fileName = `whitebg_${user.id}_${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("image-jobs")
      .upload(fileName, finalBuffer, { contentType: "image/jpeg", upsert: true });

    if (uploadError) throw uploadError;

    const { data: signedData, error: signError } = await supabase.storage
      .from("image-jobs")
      .createSignedUrl(fileName, 7 * 24 * 3600);

    if (signError || !signedData) throw signError ?? new Error("URL assinada falhou");

    // 5. Cria o job já como "done" — não precisa de GPU
    let job;
    try {
      job = await createImageJob(user.id, prompt ?? "fundo branco", input_image_url);
    } catch (err) {
      if (err instanceof RateLimitError) {
        return NextResponse.json(
          { error: "rate_limited", nextAvailableAt: err.nextAvailableAt.toISOString() },
          { status: 429 }
        );
      }
      throw err;
    }

    // Atualiza o job direto para done com a URL da imagem
    await supabase
      .from("image_jobs")
      .update({
        status: "done",
        output_image_url: signedData.signedUrl,
        mode: "fundo_branco",
      })
      .eq("id", job.id);

    return NextResponse.json({
      jobId: job.id,
      status: "done",
      output_image_url: signedData.signedUrl,
    });

  } catch (err: unknown) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "rate_limited", nextAvailableAt: err.nextAvailableAt.toISOString() },
        { status: 429 }
      );
    }
    console.error("[white-bg] erro:", err);
    return NextResponse.json({ error: "Erro ao processar imagem" }, { status: 500 });
  }
}
