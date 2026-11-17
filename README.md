# Lead Intelligence

Orquestração de **três agentes de IA (Gemini)** que transformam uma planilha bruta de empresas (ex.: exportação da junta comercial) em um **ranking de leads qualificados** com **abordagens comerciais personalizadas**.

> Feito por Welfer Marques. MVP construído em 1 dia.

## O que faz

1. **Analista de Dados**: as estatísticas são calculadas em código (CNAE, município, bairro, capital social, idade das empresas). O agente interpreta esses números e devolve insights e segmentos prioritários.
2. **Qualificador**: recebe o contexto do negócio e os segmentos do Analista e dá uma nota de 0 a 100 a cada lead, com prioridade e motivo.
3. **Redator Comercial**: escreve gancho, assunto de e-mail e mensagem de WhatsApp para os leads com maior nota.

Cada agente usa a saída do anterior. Todas as respostas vêm em JSON estruturado e alimentam o dashboard (KPIs, gráficos, ranking e exportação em CSV).

**Privacidade:** e-mail, telefone e endereço são separados **no navegador** e nunca são enviados à API nem ao modelo. Os agentes só recebem dados cadastrais públicos (CNPJ, razão social, CNAE, capital, município...).

## Arquitetura

```
index.html            front-end (upload .xlsx/.csv, orquestra os agentes passo a passo, dashboard)
api/agent.js          POST /api/agent     -> executa 1 agente (analista | qualificador | redator)
api/pipeline.js       POST /api/pipeline  -> executa os 3 agentes no servidor (para n8n, Make, curl...)
lib/agents.js         prompts, chamadas ao Gemini, estatísticas e modo demonstração
server.js             servidor local / Replit (na Vercel não é usado)
sample/               planilha de exemplo 100% fictícia
```

Sem `GEMINI_API_KEY`, o app roda em **modo demonstração**, com resultados heurísticos, para testar a interface.

## Usar a API (n8n, Make, curl)

```bash
curl -X POST https://SEU-APP.vercel.app/api/pipeline \
  -H "Content-Type: application/json" \
  -d '{"top":3,"contexto":"o que você vende...","leads":[{"cnpj":"...","razao_social":"...","cnae":"5611-2/01 Restaurantes","capital_social":"R$ 50.000,00","municipio":"Macaé","data_abertura":"10/03/2026"}]}'
```

No n8n: nó **HTTP Request** → POST → URL acima → Body JSON.

## Deploy na Vercel

1. **Chave do Gemini:** em https://aistudio.google.com, crie uma API key.
2. **GitHub:** crie um repositório `lead-intelligence` e envie os arquivos deste projeto (no site: *Add file → Upload files*). **Não** envie planilhas com dados reais.
3. **Vercel:** em https://vercel.com, entre com o GitHub e clique em *Add New → Project*. Importe o repositório e, em *Framework Preset*, escolha **Other**.
4. Em *Environment Variables*, adicione:
   - `GEMINI_API_KEY` = sua chave
   - `GEMINI_MODEL` = `gemini-3.5-flash-lite` (ou outro modelo disponível na sua conta)
5. Clique em **Deploy**. Abra a URL, teste com a planilha de exemplo e depois com a sua.

## Rodar localmente / Replit

```bash
cp .env.example .env   # coloque sua chave
npm start              # http://localhost:3000  (Node 18+, sem dependências)
```

No Replit: *Import from GitHub*, adicione `GEMINI_API_KEY` em *Secrets* e clique em **Run**.
