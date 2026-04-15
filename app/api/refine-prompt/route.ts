import { NextRequest, NextResponse } from "next/server";
import { generatePromptV2, interpretFeedback } from "@/lib/promptuso/multiagent";

/**
 * POST /api/refine-prompt
 * Refina um prompt existente com base no feedback do usuário.
 *
 * Body: {
 *   product_name: string,      // nome do produto (em inglês)
 *   scene_request?: string,    // cena desejada
 *   vision_description?: string, // descrição visual da IA
 *   user_feedback: string,     // feedback textual do usuário sobre a foto gerada
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const product_name: string =
      body?.product_name ?? body?.produto ?? body?.product ?? "";
    const scene_request: string =
      body?.scene_request ?? body?.cenario ?? body?.scene ?? "";
    const vision_description: string =
      body?.vision_description ?? body?.vision_desc ?? body?.vision ?? "";
    const user_feedback: string =
      body?.user_feedback ?? body?.feedback ?? "";

    if (!product_name) {
      return NextResponse.json(
        { ok: false, error: "Missing product_name" },
        { status: 400 }
      );
    }

    // Classifica o feedback e aplica correções ao prompt
    const feedbackAnalysis = interpretFeedback(user_feedback);

    const v2 = generatePromptV2({
      product_name,
      scene_request: scene_request || undefined,
      vision_description: vision_description || undefined,
      user_feedback,
    });

    return NextResponse.json({
      ok: true,
      positive: v2.positive_prompt,
      negative: v2.negative_prompt,
      meta: v2.meta,
      review: v2.review,
      feedback_analysis: {
        issue_types: feedbackAnalysis.issue_types,
        allowed_changes: feedbackAnalysis.allowed_changes,
        applied_fixes: feedbackAnalysis.extra_positive_notes.length > 0 || feedbackAnalysis.extra_negative_terms.length > 0,
      },
      source: "multiagent_v2_refined",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String((e as Error)?.message ?? e) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "refine-prompt-v2",
    info: "POST /api/refine-prompt com { product_name, scene_request, vision_description, user_feedback }",
  });
}
