// POST /api/pipeline  { leads: [...], contexto?: "...", top?: 5 }
// Endpoint único que orquestra os 3 agentes no servidor.
// Pode ser chamado por n8n (nó HTTP Request), Make, Zapier, curl ou outro sistema.
import { runPipeline, DEFAULT_CONTEXT } from "../lib/agents.js";
import { readBody, send, validateLeads } from "../lib/http.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  try {
    const body = await readBody(req);
    const err = validateLeads(body.leads);
    if (err) return send(res, 400, { error: err });
    const leads = body.leads.map((l, i) => ({ id: String(l.id ?? i + 1), ...l }));
    const out = await runPipeline({ leads, contexto: body.contexto || DEFAULT_CONTEXT, top: body.top || 5 });
    return send(res, 200, out);
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}
