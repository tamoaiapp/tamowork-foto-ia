"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const S3 = "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object";
const VID = "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/sign/video-jobs";

// ordem: óculos primeiro (pedido do usuário), depois tênis (novo vídeo), fantasia (novo vídeo), colar
const DEMO_CARDS = [
  {
    label: "Óculos retrô",
    before: `${S3}/public/input-images/onboard/oculos.jpeg`,
    after:  `${S3}/sign/image-jobs/d7b2fe90-4383-4f6d-92bb-672b210de218.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzL2Q3YjJmZTkwLTQzODMtNGY2ZC05MmJiLTY3MmIyMTBkZTIxOC5qcGciLCJpYXQiOjE3NzQ5NTgwMDUsImV4cCI6MjA5MDMxODAwNX0.4DG7PNfy--I0dO76hrsxIQvYnKgZ9YkaYicebKzR98w`,
    video:  `${VID}/396aed09-3745-4d78-8b0a-5aec13513282.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlby1qb2JzLzM5NmFlZDA5LTM3NDUtNGQ3OC04YjBhLTVhZWMxMzUxMzI4Mi5tcDQiLCJpYXQiOjE3NzQ5NTg2NTMsImV4cCI6MjA5MDMxODY1M30.5H9g-PfaOIG0HUMAdTb-SiyWNbovLhoUSb1n0Pq4YrM`,
  },
  {
    label: "Tênis bordado",
    before: `${S3}/public/input-images/onboard/tenis.jpg`,
    after:  `${S3}/sign/image-jobs/800f27c5-7d73-4603-b252-d2e9853563b8.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzLzgwMGYyN2M1LTdkNzMtNDYwMy1iMjUyLWQyZTk4NTM1NjNiOC5qcGciLCJpYXQiOjE3NzQ5NTgwMDQsImV4cCI6MjA5MDMxODAwNH0.WnYrCu2rEopYvByQKFu8L5Hm-3jzA9IXUqgjuFI2unQ`,
    video:  `${VID}/6ce857bd-9f7f-43db-a624-08da9a9050bd.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlby1qb2JzLzZjZTg1N2JkLTlmN2YtNDNkYi1hNjI0LTA4ZGE5YTkwNTBiZC5tcDQiLCJpYXQiOjE3NzQ5NjE1NTksImV4cCI6MjA5MDMyMTU1OX0.q_JFA0rsLIL73L560WcYZAQI_iSW7m4sMdqxFfAA6OQ`,
  },
  {
    label: "Fantasia infantil",
    before: `${S3}/public/input-images/onboard/fantasia.webp`,
    after:  `${S3}/sign/image-jobs/4bfe5d4a-7d6a-41e9-8c15-15ecbc4e1571.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzLzRiZmU1ZDRhLTdkNmEtNDFlOS04YzE1LTE1ZWNiYzRlMTU3MS5qcGciLCJpYXQiOjE3NzQ5NTgwMDUsImV4cCI6MjA5MDMxODAwNX0.mItnYXMEOLDmMn8ViKTZz219qSx9dNOKoGoEWyYCbno`,
    video:  `${VID}/11af3ceb-12fa-4c05-bb66-5f4ad981bc1c.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlby1qb2JzLzExYWYzY2ViLTEyZmEtNGMwNS1iYjY2LTVmNGFkOTgxYmMxYy5tcDQiLCJpYXQiOjE3NzQ5NjE1NjAsImV4cCI6MjA5MDMyMTU2MH0.UEaFTP_FxncuvR_FYvzqFgC4e-TwdDXUdmw2v6xTj1g`,
  },
  {
    label: "Colar de praia",
    before: `${S3}/public/input-images/onboard/colar.webp`,
    after:  `${S3}/sign/image-jobs/e307caef-e00b-4e45-b27e-311090bbe285.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzL2UzMDdjYWVmLWUwMGItNGU0NS1iMjdlLTMxMTA5MGJiZTI4NS5qcGciLCJpYXQiOjE3NzQ5NTgwMDQsImV4cCI6MjA5MDMxODAwNH0.8y-i7FEDxSDPJxHkwKwZ4LkctT1a04eTOw46Tek0UXE`,
    video:  `${VID}/aa76a131-3cde-4c1d-bbfa-af6686fcc1be.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlby1qb2JzL2FhNzZhMTMxLTNjZGUtNGMxZC1iYmZhLWFmNjY4NmZjYzFiZS5tcDQiLCJpYXQiOjE3NzQ5NTg2NTQsImV4cCI6MjA5MDMxODY1NH0.FgXQHovRxQK3TEwLOWY2weOCbPPdvlsrIZVS1B4Nyfc`,
  },
];

type Screen = 1 | 2 | 3;
type Plan = "weekly" | "annual";

const BRAND = "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)";
const ACCENT = "#a855f7";
const BG = "#07080b";
const CARD = "#111820";
const LINE = "rgba(255,255,255,0.07)";
const TOTAL_STEPS = 3;

function DemoCarousel() {
  const [idx, setIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  function goTo(next: number) {
    setIdx((next + DEMO_CARDS.length) % DEMO_CARDS.length);
  }

  // quando troca de card, reinicia o vídeo
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [idx]);

  const card = DEMO_CARDS[idx];

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Nome do produto */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>{card.label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: `${ACCENT}22`, padding: "3px 10px", borderRadius: 20 }}>
          {idx + 1}/{DEMO_CARDS.length}
        </span>
      </div>

      {/* Fotos lado a lado — mesma dimensão */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div style={{ position: "relative", borderRadius: 14, overflow: "hidden" }}>
          <img
            src={card.before}
            alt="antes"
            style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
          />
          <span style={{
            position: "absolute", bottom: 6, left: 6,
            background: "rgba(0,0,0,0.72)", color: "#aaa",
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, letterSpacing: 1,
          }}>ANTES</span>
        </div>
        <div style={{ position: "relative", borderRadius: 14, overflow: "hidden" }}>
          <img
            src={card.after}
            alt="foto ia"
            style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
          />
          <span style={{
            position: "absolute", bottom: 6, left: 6,
            background: ACCENT, color: "#fff",
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, letterSpacing: 1,
          }}>FOTO IA</span>
        </div>
      </div>

      {/* Vídeo abaixo — avança ao terminar. Se não tem vídeo, pula sozinho após 3s */}
      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#000", lineHeight: 0 }}>
        {card.video ? (
          <video
            ref={videoRef}
            key={card.video}
            src={card.video}
            autoPlay
            muted
            playsInline
            onEnded={() => goTo(idx + 1)}
            style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
          />
        ) : (
          <img
            src={card.after}
            alt="foto ia"
            style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
          />
        )}
        {/* badge produto */}
        <div style={{
          position: "absolute", top: 8, left: 8,
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
          borderRadius: 8, padding: "3px 10px",
          fontSize: 11, fontWeight: 700, color: "#fff",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
          {card.label}
        </div>
        {/* badge */}
        <span style={{
          position: "absolute", bottom: 8, left: 8,
          background: `${ACCENT}dd`, color: "#fff",
          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, letterSpacing: 1,
        }}>{card.video ? "VÍDEO IA" : "FOTO IA"}</span>
      </div>

      {/* Dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 5 }}>
        {DEMO_CARDS.map((_, i) => (
          <div
            key={i}
            onClick={() => goTo(i)}
            style={{
              width: i === idx ? 18 : 6, height: 6,
              borderRadius: 99,
              background: i === idx ? ACCENT : "rgba(255,255,255,0.25)",
              transition: "all 0.3s ease", cursor: "pointer",
            }}
          />
        ))}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}

// lg: logo css — shape: "sq"=quadrado, "ci"=círculo, "pi"=pílula | g: gradiente [from, to]
const ROWS: { store: string; city: string; quote: string; ab: string; g: [string,string]; shape: "sq"|"ci"|"pi" }[][] = [
  [
    { store:"Kick Store",    city:"São Paulo, SP",      ab:"KS", g:["#6366f1","#818cf8"], shape:"sq", quote:"Vendia tênis em brechó e ninguém valorizava. Depois das fotos com IA, o pessoal parou de pechinchar." },
    { store:"Ateliê Cami",   city:"Recife, PE",         ab:"AC", g:["#ec4899","#f472b6"], shape:"ci", quote:"Troquei as fotos com IA e as vendas dobraram no mesmo mês. Não esperava resultado tão rápido." },
    { store:"Modinha Kids",  city:"BH, MG",             ab:"MK", g:["#8b5cf6","#a78bfa"], shape:"pi", quote:"40 mensagens no direct depois de um vídeo gerado pela IA num domingo à noite." },
    { store:"Óticas BemVer", city:"Fortaleza, CE",      ab:"OB", g:["#f97316","#fb923c"], shape:"sq", quote:"A cliente perguntou se eu tinha contratado fotógrafo. A foto foi tirada com meu celular." },
    { store:"Bolsas da Rê",  city:"Rio de Janeiro, RJ", ab:"BR", g:["#10b981","#34d399"], shape:"ci", quote:"Reels com foto de IA chegou a 80 mil visualizações em 3 dias. Antes mal passava de 200." },
    { store:"Lume Aromas",   city:"Salvador, BA",       ab:"LA", g:["#f59e0b","#fbbf24"], shape:"pi", quote:"A foto capturou exatamente o clima artesanal que eu queria. Agora vendo para empresa também." },
    { store:"Malu Cosméticos",city:"Natal, RG",         ab:"MC", g:["#ec4899","#f9a8d4"], shape:"sq", quote:"Produto de beleza precisa de foto bonita. Com a IA os produtos parecem de marca grande." },
    { store:"Tri Suplementos",city:"Goiânia, GO",       ab:"TS", g:["#3b82f6","#60a5fa"], shape:"ci", quote:"Meu concorrente usa estúdio caro. Eu uso IA e minha foto ficou melhor que a dele." },
    { store:"Casa & Decor",  city:"Curitiba, PR",       ab:"CD", g:["#14b8a6","#2dd4bf"], shape:"pi", quote:"Móvel em foto ruim parece barato. Com IA o produto transmite qualidade antes mesmo de ver o preço." },
    { store:"Viva Moda",     city:"Porto Alegre, RS",   ab:"VM", g:["#a855f7","#c084fc"], shape:"sq", quote:"Triplicamos as consultas no WhatsApp depois de atualizar as fotos do catálogo com IA." },
  ],
  [
    { store:"Praia & Estilo",city:"Florianópolis, SC",  ab:"PE", g:["#0ea5e9","#38bdf8"], shape:"pi", quote:"Moda praia sem modelo e estúdio. Com a IA ficou em minutos. Parece foto de revista." },
    { store:"Uni Papelaria", city:"Campinas, SP",       ab:"UP", g:["#f43f5e","#fb7185"], shape:"sq", quote:"Meu cliente perguntou se abri loja física. Só tenho online. As fotos com IA mudaram tudo." },
    { store:"Natura da Terra",city:"Belo Horizonte, MG",ab:"NT", g:["#22c55e","#4ade80"], shape:"ci", quote:"Produto natural precisa passar cuidado. A IA fez isso em segundos. Nunca consegui com celular." },
    { store:"Patinhas Pet",  city:"Porto Alegre, RS",   ab:"PP", g:["#f97316","#fdba74"], shape:"pi", quote:"De 10 para 60 pedidos por semana no Shopee só de trocar as fotos dos produtos com IA." },
    { store:"Doce Arte",     city:"Fortaleza, CE",      ab:"DA", g:["#ec4899","#f9a8d4"], shape:"sq", quote:"Bolo de festa precisa de foto que dá água na boca. Com IA meu WhatsApp não para de chamar." },
    { store:"TechAcessórios",city:"São Paulo, SP",      ab:"TA", g:["#6366f1","#a5b4fc"], shape:"ci", quote:"Eletrônico em foto escura não vende. Com IA ficou com aquela cara de loja premium do Mercado Livre." },
    { store:"Artes do Mar",  city:"Maceió, AL",         ab:"AM", g:["#0284c7","#0ea5e9"], shape:"pi", quote:"Artesanato precisa de foto que conta a história. A IA entendeu isso sem eu precisar explicar." },
    { store:"BabyLuxo",      city:"Brasília, DF",       ab:"BL", g:["#d946ef","#e879f9"], shape:"sq", quote:"Enxoval de bebê precisa transmitir delicadeza. As fotos com IA conseguem isso de forma incrível." },
    { store:"FitNutrição",   city:"Recife, PE",         ab:"FN", g:["#16a34a","#22c55e"], shape:"ci", quote:"Suplemento em foto ruim parece falsificado. Com IA o produto ganhou credibilidade instantânea." },
    { store:"Sabores da Vó", city:"Salvador, BA",       ab:"SV", g:["#dc2626","#f87171"], shape:"pi", quote:"Comida caseira com foto de IA vende como gourmet. Aumentei o preço e as vendas subiram mesmo assim." },
  ],
  [
    { store:"Couros & Cia",  city:"Franca, SP",         ab:"CC", g:["#78716c","#a8a29e"], shape:"sq", quote:"Bolsa de couro precisa de foto que mostra textura. A IA fez isso melhor que qualquer celular." },
    { store:"Bike Total",    city:"Manaus, AM",         ab:"BT", g:["#0891b2","#22d3ee"], shape:"ci", quote:"Bicicleta é produto caro. Foto com IA passou confiança e reduzimos as perguntas antes de comprar." },
    { store:"Jardim Vivo",   city:"Cuiabá, MT",         ab:"JV", g:["#65a30d","#84cc16"], shape:"pi", quote:"Planta em foto escura parece murcha. Com IA os vasos ficam lindos e as vendas online decolaram." },
    { store:"Studio Tattoo", city:"São Paulo, SP",      ab:"ST", g:["#1c1917","#44403c"], shape:"sq", quote:"Tatuagem precisa de foto nítida. A IA melhorou tudo que o celular não conseguia capturar." },
    { store:"Mel & Cera",    city:"Ribeirão Preto, SP", ab:"ME", g:["#d97706","#fbbf24"], shape:"ci", quote:"Produto artesanal de mel parece premium com IA. O preço subiu e a fila de encomendas também." },
    { store:"Óptica Vision", city:"Belém, PA",          ab:"OV", g:["#0f766e","#14b8a6"], shape:"pi", quote:"Armação de óculos precisa de ângulo certo. Com IA cada produto parece catálogo de importado." },
    { store:"Mimos de Luz",  city:"Fortaleza, CE",      ab:"ML", g:["#be185d","#ec4899"], shape:"sq", quote:"Lembranças de festa vendem pela aparência. Com IA o produto virou referência no meu nicho." },
    { store:"Roots Calçados",city:"Novo Hamburgo, RS",  ab:"RC", g:["#b45309","#d97706"], shape:"ci", quote:"Calçado sem modelo é difícil de vender online. A IA resolve isso de um jeito que parece real." },
    { store:"Toque Floral",  city:"Campinas, SP",       ab:"TF", g:["#9333ea","#c084fc"], shape:"pi", quote:"Buquê de flores precisa de foto que transmite cheiro. Com IA as encomendas pelo Insta explodiram." },
    { store:"Bem Estar Shop",city:"Uberlândia, MG",     ab:"BE", g:["#0369a1","#0ea5e9"], shape:"sq", quote:"Produto de bem-estar precisa de foto tranquila. A IA gerou exatamente essa sensação que eu queria." },
  ],
];

const PEOPLE = [
  { name:"Ana C.",     bg:"#f43f5e" },
  { name:"Pedro M.",   bg:"#3b82f6" },
  { name:"Juliana R.", bg:"#8b5cf6" },
  { name:"Carlos S.",  bg:"#f97316" },
  { name:"Mariana F.", bg:"#10b981" },
  { name:"Lucas T.",   bg:"#6366f1" },
  { name:"Camila B.",  bg:"#ec4899" },
];

const CARD_W = 190;

function Screen2({ onNext }: { onNext: () => void }) {
  const [off, setOff] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setOff(o => {
      const reset = CARD_W * ROWS[0].length;
      return o >= reset ? 0 : o + 0.35;
    }), 16);
    return () => clearInterval(id);
  }, []);

  const speeds = [1, 0.75, 1.25]; // velocidade relativa por linha

  return (
    <div style={{ position:"fixed", inset:0, maxWidth:430, margin:"0 auto", background:BG, display:"flex", flexDirection:"column", overflow:"hidden" }}>

      <div style={{ padding:"52px 24px 16px", flexShrink:0 }}>
        <h1 style={{ fontSize:24, fontWeight:800, lineHeight:1.3, margin:0, animation:"fadeUp 0.5s ease both" }}>
          Você trabalha muito.<br />
          <span style={{ color:ACCENT }}>Sua foto precisa trabalhar também.</span>
        </h1>
      </div>

      {/* 3 faixas */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", gap:10, overflow:"hidden" }}>
        {ROWS.map((row, ri) => {
          const loop = [...row, ...row];
          const dir = ri % 2 === 0 ? 1 : -1;
          const o = off * speeds[ri];
          const reset = CARD_W * row.length;
          const tx = dir > 0 ? -(o % reset) : -(reset - (o % reset));
          return (
            <div key={ri} style={{ overflow:"hidden" }}>
              <div style={{ display:"flex", gap:10, paddingLeft:16, transform:`translateX(${tx}px)`, willChange:"transform" }}>
                {loop.map((r, i) => <RefCard key={i} r={r} />)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pessoas reais */}
      <div style={{ padding:"10px 24px 8px", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ display:"flex" }}>
            {PEOPLE.map((p, i) => (
              <div key={i} style={{ width:30, height:30, borderRadius:"50%", background:p.bg, border:"2px solid #07080b", marginLeft:i===0?0:-8, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:11, fontWeight:800, color:"#fff" }}>{p.name.split(" ").map(w=>w[0]).join("").slice(0,2)}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)" }}>
            mais de <span style={{ color:"rgba(255,255,255,0.85)", fontWeight:700 }}>26.000 vendedores</span> já usam
          </div>
        </div>
      </div>

      <div style={{ padding:"0 24px 28px", flexShrink:0 }}>
        <button style={s.btnYellow} onClick={onNext}>Quero vender mais →</button>
      </div>

      <style>{`@keyframes fadeUp { from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  );
}

function StoreLogo({ r }: { r: typeof ROWS[0][0] }) {
  const radius = r.shape === "ci" ? "50%" : r.shape === "pi" ? "20px" : "8px";
  return (
    <div style={{ width:36, height:36, borderRadius:radius, background:`linear-gradient(135deg, ${r.g[0]}, ${r.g[1]})`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:`0 2px 8px ${r.g[0]}55` }}>
      <span style={{ fontSize:12, fontWeight:900, color:"#fff", letterSpacing:"-0.5px" }}>{r.ab}</span>
    </div>
  );
}

function RefCard({ r }: { r: typeof ROWS[0][0] }) {
  return (
    <div style={{ width:CARD_W, flexShrink:0, background:CARD, borderRadius:14, padding:"13px 14px", border:`1px solid ${LINE}` }}>
      <div style={{ fontSize:12, color:"rgba(255,255,255,0.72)", lineHeight:1.55, marginBottom:11, display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" } as React.CSSProperties}>
        "{r.quote}"
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <StoreLogo r={r} />
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#fff", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.store}</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:1 }}>{r.city}</div>
        </div>
        <div style={{ marginLeft:"auto", fontSize:11, color:"#fbbf24", flexShrink:0 }}>★★★★★</div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>(1);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("annual");
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [showRegPopup, setShowRegPopup] = useState(false);

  // Register state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    // Se já fez onboarding, vai pro app
    if (typeof window !== "undefined" && localStorage.getItem("tw_onboarding_done")) {
      router.replace("/");
    }
  }, [router]);

  function goNext() {
    if (animating) return;
    advanceScreen();
  }

  function advanceScreen() {
    setAnimating(true);
    setTimeout(() => {
      setScreen((s) => (s < 3 ? (s + 1) as Screen : 3));
      setAnimating(false);
    }, 200);
  }

  async function handleNotifPopup(accept: boolean) {
    setShowNotifPopup(false);
    if (accept && typeof Notification !== "undefined") {
      await Notification.requestPermission();
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegLoading(true);
    setRegError("");

    // Verifica se já está logado
    const { data: { user: existing } } = await supabase.auth.getUser();
    if (existing) {
      setScreen(3);
      setRegLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: { data: { full_name: regName } },
    });

    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("already registered") || m.includes("already exists")) {
        // Tenta logar
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email: regEmail, password: regPassword });
        if (loginErr) {
          setRegError("E-mail já cadastrado. Verifique sua senha.");
        } else {
          setScreen(3);
        }
      } else if (m.includes("password")) {
        setRegError("Senha deve ter pelo menos 6 caracteres.");
      } else if (m.includes("email")) {
        setRegError("E-mail inválido.");
      } else {
        setRegError("Erro ao criar conta. Tente novamente.");
      }
      setRegLoading(false);
      return;
    }

    if (data.session || data.user) {
      setScreen(3);
    } else {
      setRegError("Verifique seu e-mail para confirmar o cadastro.");
    }
    setRegLoading(false);
  }

  async function handleCheckoutClick() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setShowRegPopup(true);
      return;
    }
    await goToCheckout(session.access_token);
  }

  async function goToCheckout(token: string) {
    setLoadingCheckout(true);
    try {
      const body = selectedPlan === "weekly" ? { plan: "monthly" } : {};
      const res = await fetch("/api/checkout/mercadopago", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.init_point) {
        localStorage.setItem("tw_onboarding_done", "1");
        window.location.href = json.init_point;
      }
    } catch {
      // ignore
    } finally {
      setLoadingCheckout(false);
    }
  }

  function skip() {
    localStorage.setItem("tw_onboarding_done", "1");
    router.replace("/");
  }

  const step = screen;

  const progress = step / TOTAL_STEPS;

  return (
    <div style={s.root}>
      {/* Progress bar */}
      {(
        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: `${progress * 100}%` }} />
        </div>
      )}

      {/* Popup cadastro rápido antes do checkout */}
      {showRegPopup && (
        <div style={s.popupOverlay}>
          <div style={{ ...s.popupBox, padding: "28px 24px" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>👤</div>
            <div style={s.popupTitle}>Crie sua conta</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 20, textAlign: "center" }}>
              É rápido. Depois vamos ao pagamento.
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setRegLoading(true);
              setRegError("");
              const { data, error } = await supabase.auth.signUp({ email: regEmail, password: regPassword, options: { data: { full_name: regName } } });
              if (error) {
                const m = error.message.toLowerCase();
                if (m.includes("already registered") || m.includes("already exists")) {
                  const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email: regEmail, password: regPassword });
                  if (loginErr) { setRegError("Senha incorreta."); setRegLoading(false); return; }
                  setShowRegPopup(false);
                  await goToCheckout(loginData.session!.access_token);
                } else {
                  setRegError("Erro ao criar conta. Tente novamente.");
                }
                setRegLoading(false);
                return;
              }
              if (data.session) {
                setShowRegPopup(false);
                await goToCheckout(data.session.access_token);
              } else {
                setRegError("Confirme seu e-mail para continuar.");
              }
              setRegLoading(false);
            }} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
              <input type="text" placeholder="Seu nome" value={regName} onChange={e => setRegName(e.target.value)} required style={s.regInput} />
              <input type="email" placeholder="seu@email.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} required style={s.regInput} />
              <input type="password" placeholder="Senha (mín. 6 caracteres)" value={regPassword} onChange={e => setRegPassword(e.target.value)} required minLength={6} style={s.regInput} />
              {regError && <div style={{ fontSize: 12, color: "#f87171", textAlign: "center" }}>{regError}</div>}
              <button type="submit" disabled={regLoading} style={{ ...s.btnYellow, opacity: regLoading ? 0.7 : 1, marginTop: 4 }}>
                {regLoading ? "Aguarde..." : "Continuar para pagamento →"}
              </button>
              <button type="button" style={s.popupBtnGhost} onClick={() => setShowRegPopup(false)}>Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {/* Popup notificação */}
      {showNotifPopup && (
        <div style={s.popupOverlay}>
          <div style={s.popupBox}>
            <div style={s.popupIcon}>🔔</div>
            <div style={s.popupTitle}>Ativar notificações?</div>
            <div style={s.popupSub}>Saiba quando sua foto estiver pronta.</div>
            <button style={s.popupBtnYellow} onClick={() => handleNotifPopup(true)}>
              Ativar
            </button>
            <button style={s.popupBtnGhost} onClick={() => handleNotifPopup(false)}>
              Agora não
            </button>
          </div>
        </div>
      )}

      <div style={{ ...s.screen, opacity: animating ? 0 : 1, transition: "opacity 0.2s" }}>

        {/* TELA 1 — carrossel antes/depois + vídeo */}
        {screen === 1 && (
          <div style={{ ...s.contentScreen, overflowY: "auto", paddingTop: 20, paddingBottom: 100 }}>
            <div style={{ marginBottom: 14 }}>
              <h1 style={{ ...s.screenTitle, margin: 0, fontSize: 24 }}>
                Tire foto de qualquer jeito dos seus produtos,{" "}
                <span style={{ color: ACCENT }}>transforma em foto que vende</span>{" "}
                e faz vídeo viral
              </h1>
            </div>
            <DemoCarousel />
            <div style={{ ...s.bottomArea, position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: `linear-gradient(transparent, ${BG} 40%)`, paddingTop: 40, paddingBottom: 20 }}>
              <button style={s.btnYellow} onClick={goNext}>Ver como funciona →</button>
            </div>
          </div>
        )}

        {/* TELA 2 — Apelo emocional com depoimentos rotativas */}
        {screen === 2 && <Screen2 onNext={goNext} />}

        {/* TELA 3 — PAGAMENTO */}
        {screen === 3 && (
          <div style={s.paywallScreen}>
            <div style={s.paywallScroll}>
              <h1 style={s.paywallTitle}>
                Fotos e vídeos{" "}
                <span style={{ color: ACCENT }}>ilimitados</span>{" "}
                para vender mais
              </h1>
              <p style={s.paywallSub}>Acesso completo. Sem limite de uso.</p>

              {/* Benefícios */}
              <div style={s.benefitsList}>
                {[
                  "Fotos ilimitadas para seus produtos",
                  "Vídeos ilimitados prontos para Reels e TikTok",
                  "Modelos humanos com IA",
                  "Alta resolução sem marca d'água",
                  "Pronto para Instagram, Shopee e WhatsApp",
                ].map((b) => (
                  <div key={b} style={s.benefitItem}>
                    <span style={s.benefitCheck}>✓</span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>

              {/* Planos */}
              <div style={s.plansArea}>
                {/* Anual */}
                <button
                  style={{ ...s.planCard, ...(selectedPlan === "annual" ? s.planCardSelected : {}), position: "relative", overflow: "visible" }}
                  onClick={() => setSelectedPlan("annual")}
                >
                  <div style={{ position: "absolute", top: -11, right: 14, background: BRAND, color: "#fff", fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20, letterSpacing: "0.06em" }}>
                    MAIS POPULAR
                  </div>
                  <div style={s.planRadio}>
                    <div style={{ ...s.planRadioInner, ...(selectedPlan === "annual" ? s.planRadioActive : {}) }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={s.planName}>Plano Anual</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>R$348 cobrado uma vez por ano</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textDecoration: "line-through" }}>R$47/sem</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>R$29<span style={{ fontSize: 12, fontWeight: 500 }}>/mês</span></div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: ACCENT, lineHeight: 1 }}>R$0,95<span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.5)" }}>/dia</span></div>
                  </div>
                </button>

                {/* Semanal */}
                <button
                  style={{ ...s.planCard, ...(selectedPlan === "weekly" ? s.planCardSelected : {}) }}
                  onClick={() => setSelectedPlan("weekly")}
                >
                  <div style={s.planRadio}>
                    <div style={{ ...s.planRadioInner, ...(selectedPlan === "weekly" ? s.planRadioActive : {}) }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={s.planName}>Semanal</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Acesso completo por 7 dias</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>R$47<span style={{ fontSize: 12, fontWeight: 500 }}>/sem</span></div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>R$6,71/dia</div>
                  </div>
                </button>
              </div>

              <div style={s.cancelNote}>↺ Cancele quando quiser</div>
              <div style={{ ...s.conversionLine, marginTop: 8 }}>Uma foto que vende já paga o mês inteiro.</div>
            </div>

            <div style={s.paywallBottom}>
              <button
                style={{ ...s.btnYellow, opacity: loadingCheckout ? 0.7 : 1 }}
                onClick={handleCheckoutClick}
                disabled={loadingCheckout}
              >
                {loadingCheckout ? "Aguarde..." : "Começar agora"}
              </button>
              <button style={s.btnGhost} onClick={skip}>Talvez mais tarde</button>
              <div style={s.legalRow}>
                <span style={s.legalLink}>Política de Privacidade</span>
                <span style={s.legalLink}>Restaurar Compras</span>
                <span style={s.legalLink}>Termos de Uso</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: BG,
    color: "#eef2f9",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Outfit', sans-serif",
    maxWidth: 430,
    margin: "0 auto",
    position: "relative",
    overflow: "hidden",
  },
  progressBar: {
    height: 3,
    background: "rgba(255,255,255,0.1)",
    position: "fixed",
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: 430,
    zIndex: 100,
  },
  progressFill: {
    height: "100%",
    background: BRAND,
    transition: "width 0.4s ease",
    borderRadius: 2,
  },
  screen: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
  },

  // --- TELA 0 NOTIFICAÇÕES ---
  notifScreen: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "60px 24px 40px",
    minHeight: "100vh",
  },
  notifContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  notifTitle: {
    fontSize: 28,
    fontWeight: 800,
    textAlign: "center",
    lineHeight: 1.2,
    margin: "0 0 12px",
    color: "#fff",
  },
  notifSub: {
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 1.5,
    margin: "0 0 40px",
  },
  notifMockup: {
    display: "flex",
    justifyContent: "center",
    width: "100%",
  },
  phoneMock: {
    width: 220,
    height: 380,
    background: CARD,
    borderRadius: 32,
    border: "2px solid #222",
    overflow: "hidden",
    position: "relative",
  },
  phoneScreen: {
    width: "100%",
    height: "100%",
    background: "#0a0a0a",
    padding: 12,
    position: "relative",
  },
  appGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginTop: 8,
  },
  appCard: {
    borderRadius: 16,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    aspectRatio: "1",
  },
  appCardIcon: { fontSize: 28 },
  appCardLabel: { fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: 600 },
  notifBubble: {
    position: "absolute",
    top: 16,
    left: -8,
    right: 8,
    background: "rgba(30,30,30,0.95)",
    backdropFilter: "blur(10px)",
    borderRadius: 14,
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    animation: "slideDown 0.5s ease 0.5s both",
  },
  notifBubbleIcon: { fontSize: 24, flexShrink: 0 },
  notifBubbleTitle: { fontSize: 13, fontWeight: 700, color: "#fff" },
  notifBubbleSub: { fontSize: 11, color: "rgba(255,255,255,0.5)" },

  // --- TELAS DE CONTEÚDO ---
  contentScreen: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: "60px 24px 24px",
    minHeight: "100vh",
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1.2,
    margin: "0 0 24px",
    letterSpacing: "-0.02em",
  },
  screenSub: {
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 1.6,
    whiteSpace: "pre-line",
    margin: "16px 0 0",
  },
  imageArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  // Before/After
  beforeAfterRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  beforeCard: { flex: 1 },
  afterCard: { flex: 1 },
  beforeImg: {
    background: "#0c1018",
    borderRadius: 20,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    aspectRatio: "0.85",
    justifyContent: "center",
    border: "1px solid #333",
  },
  afterImg: {
    background: "linear-gradient(135deg, #1a1a2e, #533483)",
    borderRadius: 20,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    aspectRatio: "0.85",
    justifyContent: "center",
    boxShadow: `0 0 30px rgba(168,85,247,0.3)`,
    border: `2px solid ${ACCENT}40`,
  },
  productEmoji: { fontSize: 56 },
  beforeLabel: { fontSize: 13, color: "#666", fontWeight: 600 },
  afterLabel: { fontSize: 13, color: ACCENT, fontWeight: 700 },
  afterSub: { fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "center" },
  arrowBetween: { fontSize: 24, color: ACCENT, fontWeight: 700, flexShrink: 0 },

  // Pain
  painCard: {
    display: "flex",
    gap: 12,
  },
  painLeft: { flex: 1 },
  painRight: { flex: 1 },
  painProductBad: {
    background: "#0c1018",
    borderRadius: 20,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    aspectRatio: "0.85",
    justifyContent: "center",
    border: "2px solid #ef4444",
  },
  painProductGood: {
    background: "linear-gradient(135deg, #0f3460, #533483)",
    borderRadius: 20,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    aspectRatio: "0.85",
    justifyContent: "center",
    border: `2px solid ${ACCENT}`,
    boxShadow: `0 0 30px rgba(168,85,247,0.2)`,
  },

  // Solution grid
  solutionGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  solutionCard: {
    borderRadius: 20,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    aspectRatio: "1",
    justifyContent: "center",
  },
  solutionCardLabel: { fontSize: 14, fontWeight: 700, color: "#fff" },

  // Unlimited
  unlimitedGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 10,
    marginBottom: 16,
  },
  unlimitedCard: {
    borderRadius: 16,
    aspectRatio: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 36,
  },
  unlimitedBadge: {
    background: BRAND,
    color: "#fff",
    fontWeight: 900,
    fontSize: 20,
    borderRadius: 50,
    padding: "10px 28px",
    textAlign: "center",
    letterSpacing: "0.05em",
  },

  // Speed
  speedCard: {
    background: CARD,
    borderRadius: 24,
    padding: 24,
    border: "1px solid #222",
  },
  speedRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  speedItem: { textAlign: "center" },
  speedIcon: { fontSize: 40, marginBottom: 8 },
  speedLabel: { fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 4 },
  speedTime: { fontSize: 18, fontWeight: 800, color: "#ef4444" },
  speedVs: { fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.3)" },
  speedBar: {
    height: 6,
    background: "rgba(255,255,255,0.07)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 14,
  },
  speedBarFill: {
    height: "100%",
    width: "92%",
    background: `linear-gradient(90deg, #ef4444 0%, ${ACCENT} 100%)`,
    borderRadius: 3,
  },
  speedNote: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 1.5,
  },

  // Employee
  employeeCard: {
    background: CARD,
    borderRadius: 24,
    padding: 28,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    border: `1px solid ${ACCENT}30`,
  },
  employeeAvatar: {
    fontSize: 56,
    background: "#0c1018",
    borderRadius: 50,
    width: 80,
    height: 80,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `2px solid ${ACCENT}`,
  },
  employeeName: { fontSize: 18, fontWeight: 800, color: "#fff", marginTop: 4 },
  employeeRole: { fontSize: 13, color: ACCENT, fontWeight: 600, marginBottom: 12 },
  employeeTasks: { width: "100%", display: "flex", flexDirection: "column", gap: 10 },
  employeeTask: { fontSize: 15, color: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center" },

  // Bottom area
  bottomArea: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    paddingTop: 24,
    paddingBottom: 8,
  },

  // --- PAYWALL ---
  paywallScreen: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
  },
  paywallScroll: {
    flex: 1,
    padding: "60px 24px 24px",
    overflowY: "auto",
  },
  paywallTitle: {
    fontSize: 30,
    fontWeight: 900,
    lineHeight: 1.2,
    margin: "0 0 12px",
    whiteSpace: "pre-line",
    letterSpacing: "-0.02em",
  },
  paywallSub: {
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 1.6,
    margin: "0 0 24px",
  },
  benefitsList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginBottom: 20,
  },
  benefitItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 15,
    color: "#fff",
    fontWeight: 500,
  },
  benefitCheck: {
    color: ACCENT,
    fontWeight: 800,
    fontSize: 16,
    flexShrink: 0,
  },
  conversionLine: {
    textAlign: "center",
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    fontStyle: "italic",
    margin: "4px 0 20px",
    padding: "12px 16px",
    background: "rgba(168,85,247,0.05)",
    borderRadius: 12,
    border: `1px solid ${ACCENT}20`,
  },
  plansArea: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 12,
  },
  planCard: {
    background: CARD,
    border: `1.5px solid ${LINE}`,
    borderRadius: 16,
    padding: "16px 18px",
    display: "flex",
    alignItems: "center",
    gap: 14,
    cursor: "pointer",
    textAlign: "left",
    transition: "border-color 0.2s",
    width: "100%",
  },
  planCardSelected: {
    borderColor: ACCENT,
    background: "rgba(168,85,247,0.08)",
  },
  planRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    border: "2px solid #444",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  planRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    background: "transparent",
  },
  planRadioActive: {
    background: BRAND,
  },
  planInfo: { flex: 1 },
  planName: { fontSize: 16, fontWeight: 700, color: "#fff" },
  planNameRow: { display: "flex", alignItems: "center", gap: 8 },
  planBadge: {
    fontSize: 10,
    fontWeight: 800,
    background: BRAND,
    color: "#fff",
    padding: "2px 8px",
    borderRadius: 20,
    letterSpacing: "0.05em",
  },
  planDesc: { fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 2 },
  planPrice: { fontSize: 18, fontWeight: 800, color: "#fff", flexShrink: 0 },
  cancelNote: {
    textAlign: "center",
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    margin: "4px 0 8px",
  },
  paywallBottom: {
    padding: "12px 24px 32px",
    background: BG,
    borderTop: "1px solid #111",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  legalRow: {
    display: "flex",
    justifyContent: "center",
    gap: 16,
  },
  legalLink: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    cursor: "pointer",
  },

  // Notif popup
  popupOverlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 999,
    padding: "0 16px 32px",
  },
  popupBox: {
    background: CARD,
    border: "1px solid #222",
    borderRadius: 24,
    padding: "28px 24px 20px",
    width: "100%",
    maxWidth: 400,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 8,
    animation: "slideUp 0.3s ease",
  },
  popupIcon: { fontSize: 36, marginBottom: 4 },
  popupTitle: { fontSize: 18, fontWeight: 800, color: "#fff", textAlign: "center" as const },
  popupSub: { fontSize: 14, color: "rgba(255,255,255,0.5)", textAlign: "center" as const, marginBottom: 8 },
  popupBtnYellow: {
    width: "100%",
    padding: "14px 0",
    background: BRAND,
    border: "none",
    borderRadius: 50,
    color: "#eef2f9",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "'Outfit', sans-serif",
  },
  popupBtnGhost: {
    width: "100%",
    padding: "10px 0",
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.35)",
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "'Outfit', sans-serif",
  },

  // Register form
  regForm: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    flex: 1,
  },
  regField: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  regLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: "0.03em",
  },
  regInput: {
    background: CARD,
    border: `1.5px solid ${LINE}`,
    borderRadius: 14,
    padding: "14px 16px",
    color: "#fff",
    fontSize: 16,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
    fontFamily: "'Outfit', sans-serif",
  },
  eyeBtn: {
    position: "absolute" as const,
    right: 14,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    padding: 0,
  },
  regError: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 12,
    padding: "12px 16px",
    color: "#f87171",
    fontSize: 14,
  },

  // Buttons
  btnYellow: {
    width: "100%",
    padding: "17px 0",
    background: BRAND,
    border: "none",
    borderRadius: 50,
    color: "#eef2f9",
    fontSize: 17,
    fontWeight: 800,
    cursor: "pointer",
    letterSpacing: "-0.01em",
    fontFamily: "'Outfit', sans-serif",
  },
  btnGhost: {
    width: "100%",
    padding: "12px 0",
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.4)",
    fontSize: 15,
    cursor: "pointer",
    fontFamily: "'Outfit', sans-serif",
  },
};
