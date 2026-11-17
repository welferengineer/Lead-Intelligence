// POST /api/agent  { agent: "analista" | "qualificador" | "redator", leads, contexto, segmentos }
// Executa UM agente. O front-end chama os três em sequência para mostrar o progresso.
import { agenteAnalista, agenteQualificador, agenteRedator, DEFAULT_CONTEXT, MOCK } from "../lib/agents.js";
import { readBody, send, validateLeads } from "../lib/http.js";

export const config = { maxDuration: 60 };

const AGENTS = { analista: agenteAnalista, qualificador: agenteQualificador, redator: agenteRedator };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  try {
    const body = await readBody(req);
    const fn = AGENTS[body.agent];
    if (!fn) return send(res, 400, { error: "agent deve ser analista, qualificador ou redator" });
    const err = validateLeads(body.leads);
    if (err) return send(res, 400, { error: err });
    const out = await fn({ ...body, contexto: body.contexto || DEFAULT_CONTEXT });
    return send(res, 200, { mock: MOCK, ...out });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}
