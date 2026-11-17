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


