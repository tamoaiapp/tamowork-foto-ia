"use client";

import { useEffect, useState } from "react";

interface Correction {
  id: string;
  product_keywords: string[];
  anchor_correction: string;
  notes: string;
}

interface Profile {
  lighting: string;
  background: string;
  style_pref: string;
  extra_context: string;
}

const LIGHTING_OPTIONS = [
  { value: "", label: "Padrão (sem preferência)" },
  { value: "bright natural light, sunny, warm tones", label: "☀️ Natural e quente" },
  { value: "soft diffused light, overcast, neutral tones", label: "☁️ Suave e neutro" },
  { value: "studio lighting, bright, clean white light", label: "💡 Estúdio (nítido)" },
  { value: "dramatic lighting, strong shadows, moody", label: "🎭 Dramático (sombras)" },
  { value: "golden hour light, warm amber glow", label: "🌅 Golden hour" },
];

const BG_OPTIONS = [
  { value: "", label: "Padrão (sem preferência)" },
  { value: "clean white background, studio", label: "⬜ Fundo branco limpo" },
  { value: "blurred bokeh background, out of focus environment", label: "🔵 Fundo desfocado (bokeh)" },
  { value: "natural outdoor environment", label: "🌿 Ambiente natural" },
  { value: "dark moody background, black or very dark", label: "⬛ Fundo escuro" },
  { value: "minimalist neutral gray background", label: "🔲 Cinza minimalista" },
];

const STYLE_OPTIONS = [
  { value: "", label: "Padrão (sem preferência)" },
  { value: "commercial product photography, clean, professional", label: "📦 Comercial / produto" },
  { value: "lifestyle photography, real people, candid, natural", label: "🧍 Lifestyle (pessoas reais)" },
  { value: "editorial fashion photography, artistic, high-end", label: "👗 Editorial / moda" },
  { value: "minimalist, simple composition, negative space", label: "✨ Minimalista" },
  { value: "Kodak Portra 400 film style, warm grain, analog", label: "📷 Filme analógico (Kodak)" },
];

interface Props {
  token: string;
}

export default function PromptProfileSection({ token }: Props) {
  const [profile, setProfile] = useState<Profile>({ lighting: "", background: "", style_pref: "", extra_context: "" });
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Novo item de correção
  const [newKeywords, setNewKeywords] = useState("");
  const [newAnchor, setNewAnchor] = useState("");
  const [addingCorrection, setAddingCorrection] = useState(false);

  useEffect(() => {
    fetch("/api/prompt-profile", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.profile) setProfile(d.profile);
        setCorrections(d.corrections ?? []);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function saveProfile() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/prompt-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(profile),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function addCorrection() {
    if (!newKeywords.trim() || !newAnchor.trim()) return;
    setAddingCorrection(true);
    const keywords = newKeywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);
    await fetch("/api/prompt-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ product_keywords: keywords, anchor_correction: newAnchor }),
    });
    // Recarrega correções
    const d = await fetch("/api/prompt-profile", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
    setCorrections(d.corrections ?? []);
    setNewKeywords("");
    setNewAnchor("");
    setAddingCorrection(false);
  }

  async function deleteCorrection(id: string) {
    await fetch("/api/prompt-profile", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    setCorrections(prev => prev.filter(c => c.id !== id));
  }

  if (loading) return null;

  return (
    <section style={s.section}>
      <h2 style={s.title}>🎨 Meu estilo de foto</h2>
      <p style={s.desc}>Configure como a IA gera os prompts das suas fotos. Essas preferências são aplicadas em todas as criações.</p>

      {/* Estilo global */}
      <div style={s.card}>
        <div style={s.cardTitle}>Preferências globais</div>
        <p style={s.hint}>Aplicadas em todas as fotos, independente do produto.</p>

        <div style={s.field}>
          <label style={s.label}>Iluminação</label>
          <select value={profile.lighting} onChange={e => setProfile(p => ({ ...p, lighting: e.target.value }))} style={s.select}>
            {LIGHTING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div style={s.field}>
          <label style={s.label}>Fundo</label>
          <select value={profile.background} onChange={e => setProfile(p => ({ ...p, background: e.target.value }))} style={s.select}>
            {BG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div style={s.field}>
          <label style={s.label}>Estilo fotográfico</label>
          <select value={profile.style_pref} onChange={e => setProfile(p => ({ ...p, style_pref: e.target.value }))} style={s.select}>
            {STYLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div style={s.field}>
          <label style={s.label}>Contexto extra (opcional)</label>
          <input
            value={profile.extra_context}
            onChange={e => setProfile(p => ({ ...p, extra_context: e.target.value }))}
            placeholder="Ex: sempre mostrar fundo de loja, preferir modelos femininas..."
            style={s.input}
          />
        </div>

        <button onClick={saveProfile} disabled={saving} style={s.saveBtn}>
          {saving ? "Salvando..." : saved ? "✓ Salvo!" : "Salvar preferências"}
        </button>
      </div>

      {/* Correções por produto */}
      <div style={{ ...s.card, marginTop: 16 }}>
        <div style={s.cardTitle}>Correções por produto</div>
        <p style={s.hint}>
          Ensina a IA onde colocar um produto específico. Ex: "buquê de flores" → segurar com as duas mãos. Só se aplica quando o produto bate com as palavras-chave.
        </p>

        {corrections.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {corrections.map(c => (
              <div key={c.id} style={s.correctionItem}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.correctionKeywords}>
                    {c.product_keywords.map(k => (
                      <span key={k} style={s.keywordTag}>{k}</span>
                    ))}
                  </div>
                  <div style={s.correctionAnchor}>{c.anchor_correction}</div>
                </div>
                <button onClick={() => deleteCorrection(c.id)} style={s.deleteBtn} title="Remover">×</button>
              </div>
            ))}
          </div>
        )}

        {/* Adicionar nova correção */}
        <div style={s.addForm}>
          <input
            value={newKeywords}
            onChange={e => setNewKeywords(e.target.value)}
            placeholder="Palavras-chave (separadas por vírgula) — ex: buquê, flores, bouquet"
            style={s.input}
          />
          <input
            value={newAnchor}
            onChange={e => setNewAnchor(e.target.value)}
            placeholder="Como o produto deve ser posicionado — ex: held in both hands by the bride"
            style={{ ...s.input, marginTop: 8 }}
          />
          <button
            onClick={addCorrection}
            disabled={addingCorrection || !newKeywords.trim() || !newAnchor.trim()}
            style={{ ...s.saveBtn, marginTop: 8, opacity: !newKeywords.trim() || !newAnchor.trim() ? 0.5 : 1 }}
          >
            {addingCorrection ? "Salvando..." : "+ Adicionar correção"}
          </button>
        </div>
      </div>
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  section: { marginBottom: 24 },
  title: { fontSize: 17, fontWeight: 700, color: "#eef2f9", margin: "0 0 6px" },
  desc: { fontSize: 13, color: "#8394b0", margin: "0 0 16px", lineHeight: 1.5 },
  card: {
    background: "#111820", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 18, padding: "20px 20px 20px",
  },
  cardTitle: { fontSize: 14, fontWeight: 700, color: "#eef2f9", marginBottom: 4 },
  hint: { fontSize: 12, color: "#4e5c72", margin: "0 0 16px", lineHeight: 1.5 },
  field: { marginBottom: 14 },
  label: { fontSize: 12, color: "#8394b0", fontWeight: 600, display: "block", marginBottom: 6 },
  select: {
    width: "100%", background: "#0c1018", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 10, padding: "10px 12px", color: "#eef2f9", fontSize: 14, outline: "none",
  },
  input: {
    width: "100%", background: "#0c1018", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 10, padding: "10px 12px", color: "#eef2f9", fontSize: 14, outline: "none",
    boxSizing: "border-box",
  },
  saveBtn: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    border: "none", borderRadius: 12, padding: "10px 20px",
    color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%",
  },
  correctionItem: {
    display: "flex", alignItems: "flex-start", gap: 10,
    background: "#0c1018", borderRadius: 12, padding: "12px 14px", marginBottom: 8,
    border: "1px solid rgba(255,255,255,0.05)",
  },
  correctionKeywords: { display: "flex", flexWrap: "wrap" as const, gap: 4, marginBottom: 6 },
  keywordTag: {
    background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)",
    borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "#c4b5fd", fontWeight: 600,
  },
  correctionAnchor: { fontSize: 13, color: "#8394b0", lineHeight: 1.4 },
  deleteBtn: {
    background: "none", border: "none", color: "#4e5c72", fontSize: 20,
    cursor: "pointer", padding: "0 4px", lineHeight: 1, flexShrink: 0,
  },
  addForm: { borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 },
};
