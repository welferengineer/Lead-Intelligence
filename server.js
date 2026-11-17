// Servidor local / Replit (na Vercel não é usado: lá as rotas em /api viram funções serverless).
// Uso: GEMINI_API_KEY=xxx npm start   ->  http://localhost:3000
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

// carrega .env simples, se existir
const envFile = path.join(dir, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { default: agent } = await import("./api/agent.js");
const { default: pipeline } = await import("./api/pipeline.js");

const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];
  if (url === "/api/agent") return agent(req, res);
  if (url === "/api/pipeline") return pipeline(req, res);
  if (url === "/" || url === "/index.html") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(fs.readFileSync(path.join(dir, "index.html")));
  }
  if (url.startsWith("/sample/")) {
    const f = path.join(dir, url);
    if (f.startsWith(path.join(dir, "sample")) && fs.existsSync(f)) return res.end(fs.readFileSync(f));
  }
  res.statusCode = 404;
  res.end("Not found");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Lead Intelligence rodando em http://localhost:${PORT}`);
  console.log(process.env.GEMINI_API_KEY ? `Modelo: ${process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"}` : "Sem GEMINI_API_KEY: modo demonstração");
});
