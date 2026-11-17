// Lead Intelligence — núcleo dos agentes
// Três agentes especializados (Gemini) orquestrados em sequência:
//   1. Analista de Dados   -> lê a base bruta e gera insights + segmentos prioritários
//   2. Qualificador        -> pontua cada lead usando o contexto do negócio e os segmentos do Analista
//   3. Redator Comercial   -> escreve abordagens personalizadas para os melhores leads

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const API_KEY = process.env.GEMINI_API_KEY;
export const MOCK = !API_KEY;

export const DEFAULT_CONTEXT =
  "Empresa júnior de engenharia que elabora projetos de prevenção e combate a incêndio " +
  "(exigidos pelo Corpo de Bombeiros para regularizar o estabelecimento) e instala extintores " +
  "em edificações de até 900 m². Cliente ideal: empresa recém-aberta ou em funcionamento cuja " +
  "atividade (CNAE) e porte indicam necessidade de projeto de prevenção e combate a incêndio.";

// ---------- Gemini ----------
async function callGemini(systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  return parseJson(text);
}

function parseJson(text) {
  const clean = text.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    const m = clean.match(/[\[{][\s\S]*[\]}]/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Resposta do modelo não veio em JSON válido.");
  }
}


// O modelo às vezes devolve um array solto, outro nome de chave ou um único objeto.
// Normaliza tudo para um array, para a interface nunca ficar vazia por diferença de formato.
function pickArray(out, key) {
  if (Array.isArray(out)) return out;
  if (!out || typeof out !== "object") return [];
  if (Array.isArray(out[key])) return out[key];
  const arr = Object.values(out).find(Array.isArray);
  if (arr) return arr;
  return out.id != null ? [out] : [];
}

// ---------- Estatísticas (calculadas em código, não pelo modelo) ----------
function parseMoney(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const n = String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const f = parseFloat(n);
  return Number.isFinite(f) ? f : null;
}
function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return new Date(y, +m[2] - 1, +m[1]);
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}
function topCounts(rows, key, n = 8) {
  const c = {};
  for (const r of rows) {
    const k = (r[key] || "Não informado").toString().trim() || "Não informado";
    c[k] = (c[k] || 0) + 1;
  }
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, count]) => ({ label, count }));
}

export function computeStats(leads) {
  const caps = leads.map((l) => parseMoney(l.capital_social)).filter((x) => x != null).sort((a, b) => a - b);
  const now = new Date();
  const ages = leads.map((l) => parseDate(l.data_abertura)).filter(Boolean).map((d) => (now - d) / (365.25 * 864e5));
  const median = caps.length ? caps[Math.floor(caps.length / 2)] : null;
  return {
    total: leads.length,
    capital_social_mediano: median,
    idade_media_anos: ages.length ? +(ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : null,
    abertas_ultimos_12_meses: ages.filter((a) => a <= 1).length,
    top_cnae: topCounts(leads, "cnae"),
    top_municipio: topCounts(leads, "municipio"),
    top_bairro: topCounts(leads, "bairro"),
    natureza_juridica: topCounts(leads, "natureza_juridica", 6),
  };
}

// ---------- Agente 1: Analista de Dados ----------
export async function agenteAnalista({ leads, contexto }) {
  const stats = computeStats(leads);
  if (MOCK) return { stats, ...mockAnalista(stats) };

  const system =
    "Você é um analista de dados comerciais sênior. Recebe estatísticas agregadas e uma amostra de uma " +
    "base de empresas (dados públicos de junta comercial) e identifica padrões úteis para a prospecção. " +
    "Responda SOMENTE em JSON, em português do Brasil, sem inventar números que não estejam nos dados.";
  const user = `CONTEXTO DO NEGÓCIO:\n${contexto}\n\nESTATÍSTICAS:\n${JSON.stringify(stats)}\n\n` +
    `AMOSTRA (até 25 leads):\n${JSON.stringify(leads.slice(0, 25))}\n\n` +
    `Retorne exatamente neste formato:\n{"resumo":"2-3 frases sobre a base",` +
    `"insights":["3 a 5 insights objetivos, citando números das estatísticas"],` +
    `"segmentos_prioritarios":[{"segmento":"descrição curta (ex.: CNAE X no município Y)","motivo":"por que priorizar"}]}`;
  const out = await callGemini(system, user);
  return { stats, ...out };
}

// ---------- Agente 2: Qualificador ----------
export async function agenteQualificador({ leads, contexto, segmentos = [] }) {
  if (MOCK) return { leads: mockQualificador(leads) };

  const system =
    "Você é um SDR especialista em qualificação de leads B2B. Para cada empresa, avalie o encaixe com a " +
    "oferta descrita no contexto e atribua uma nota de 0 a 100 seguindo ESTE critério, nesta ordem de peso:\n" +
    "1) Campo cnae_exige_projeto (regra fixa definida pelo usuário): 'sim (CNAE principal)' é o fator mais forte; " +
    "'sim (CNAE secundário)' é forte; 'não consta na lista' reduz a nota. Se o campo não existir, avalie pelo CNAE com cautela " +
    "e deixe claro no motivo que é uma inferência, não uma regra confirmada.\n" +
    "2) Natureza da atividade: estabelecimento físico com circulação de público (comércio, saúde, hospedagem, alimentação, educação) " +
    "pesa mais que atividade de escritório ou consultoria.\n" +
    "3) Porte e capital social. 4) Tempo de abertura (recém-aberta = momento de regularização).\n" +
    "O campo 'motivo' DEVE citar quais desses critérios definiram a nota. Não invente informações que não estão nos dados. " +
    "Responda SOMENTE em JSON, em português do Brasil.";
  const chunks = [];
  for (let i = 0; i < leads.length; i += 40) chunks.push(leads.slice(i, i + 40));
  const results = await Promise.all(
    chunks.map((chunk) =>
      callGemini(
        system,
        `CONTEXTO DO NEGÓCIO:\n${contexto}\n\nSEGMENTOS PRIORITÁRIOS (do Analista de Dados):\n${JSON.stringify(segmentos)}\n\n` +
          `LEADS:\n${JSON.stringify(chunk)}\n\nRetorne um objeto {"leads":[...]} com um item por lead, mantendo o "id":\n` +
          `{"id":"...","score":0-100,"prioridade":"alta|media|baixa","motivo":"1 frase citando os critérios usados"}`
      )
    )
  );
  return { leads: results.flatMap((r) => pickArray(r, "leads")) };
}

// ---------- Agente 3: Redator Comercial ----------
export async function agenteRedator({ leads, contexto }) {
  if (MOCK) return { abordagens: mockRedator(leads) };

  const system =
    "Você é um redator comercial. Escreve primeiras abordagens curtas, humanas e personalizadas para " +
    "WhatsApp e e-mail, citando algo específico da empresa (atividade, bairro, tempo de abertura). " +
    "Nunca prometa o que não está no contexto. Tom cordial e direto. Responda SOMENTE em JSON, em português do Brasil.";
  const user = `CONTEXTO DO NEGÓCIO:\n${contexto}\n\nLEADS PRIORITÁRIOS (com nota e motivo do Qualificador):\n${JSON.stringify(leads)}\n\n` +
    `Retorne {"abordagens":[{"id":"...","gancho":"o ângulo usado em 1 frase","assunto_email":"até 8 palavras",` +
    `"mensagem_whatsapp":"até 450 caracteres"}]}`;
  const out = await callGemini(system, user);
  return { abordagens: pickArray(out, "abordagens") };
}

// ---------- Pipeline completo (usado pela rota /api/pipeline) ----------
export async function runPipeline({ leads, contexto = DEFAULT_CONTEXT, top = 5 }) {
  const analise = await agenteAnalista({ leads, contexto });
  const { leads: scored } = await agenteQualificador({ leads, contexto, segmentos: analise.segmentos_prioritarios });
  const byId = Object.fromEntries(leads.map((l) => [String(l.id), l]));
  const ranked = scored
    .map((s) => ({ ...byId[String(s.id)], ...s }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  const { abordagens } = await agenteRedator({ leads: ranked.slice(0, top), contexto });
  return { modelo: MOCK ? "demo (sem chave)" : MODEL, analise, ranking: ranked, abordagens };
}

// ---------- Modo demonstração (sem GEMINI_API_KEY) ----------
function mockAnalista(stats) {
  const c = stats.top_cnae[0], m = stats.top_municipio[0];
  return {
    resumo: `[MODO DEMO] Base com ${stats.total} empresas. Configure GEMINI_API_KEY para análises reais.`,
    insights: [
      c ? `A atividade mais frequente é "${c.label}" (${c.count} empresas).` : "Sem CNAE informado.",
      m ? `${m.label} concentra ${m.count} empresas da base.` : "Sem município informado.",
      `${stats.abertas_ultimos_12_meses} empresas foram abertas nos últimos 12 meses.`,
    ],
    segmentos_prioritarios: c ? [{ segmento: c.label, motivo: "Maior concentração na base (demo)." }] : [],
  };
}
function mockQualificador(leads) {
  return leads.map((l) => {
    const cap = parseMoney(l.capital_social) || 0;
    const d = parseDate(l.data_abertura);
    const recente = d && (Date.now() - d) / (365.25 * 864e5) <= 1;
    const obrig = String(l.cnae_exige_projeto || "").startsWith("sim");
    const score = Math.min(100, Math.round(20 + Math.log10(cap + 1) * 6 + (recente ? 15 : 0) + (obrig ? 30 : 0)));
    return { id: l.id, score, prioridade: score >= 70 ? "alta" : score >= 50 ? "media" : "baixa",
      motivo: `[DEMO] Heurística: capital social${recente ? " + abertura recente" : ""}.` };
  });
}
function mockRedator(leads) {
  return leads.map((l) => ({
    id: l.id, gancho: "[DEMO] Abertura recente da empresa",
    assunto_email: `Regularização da ${l.nome_fantasia || l.razao_social || "sua empresa"}`,
    mensagem_whatsapp: `[DEMO] Olá! Vi que a ${l.nome_fantasia || l.razao_social} atua em ${l.municipio || "sua região"}. ` +
      "Podemos ajudar com o projeto de prevenção e combate a incêndio. Posso te explicar em 2 minutos?",
  }));
}
