// Utilitários HTTP que funcionam tanto na Vercel quanto no servidor Node local/Replit
export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(data));
}

export function validateLeads(leads) {
  if (!Array.isArray(leads) || leads.length === 0) return "Envie um array 'leads' com pelo menos 1 item.";
  if (leads.length > 200) return "Máximo de 200 leads por análise.";
  return null;
}
