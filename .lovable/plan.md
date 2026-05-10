## Objetivo

Deixar explícito, no tutorial **"Da cotação à ativação"** (passo 17 — Análise interna), que o setor de Cadastro pode **pendenciar** a solicitação pedindo documentos/fotos faltantes, e que o cadastro **fica travado até o reenvio**.

## Alteração

Arquivo: `src/data/tutoriais/cotacao-ate-ativacao.ts` — passo 17 (`titulo: '🏢 Análise interna…'`).

Substituir a dica `1️⃣` atual por uma versão expandida e adicionar uma nova dica logo abaixo deixando claro o bloqueio:

- **1️⃣ (atualizada)** — Cadastro confere CNH e CRLV/CRV/NF (mesmo OCR aprovado passa por revisão manual). **Se faltar foto, documento ou algum dado estiver ilegível/divergente, o analista pendencia a solicitação** e o cliente recebe um link por WhatsApp para reenviar exatamente o que foi pedido.
- **⛔ (nova)** — **Enquanto a pendência não for resolvida pelo cliente, o cadastro NÃO avança** — vistoria, instalação e ativação ficam bloqueadas. Assim que o reenvio chega, a solicitação volta automaticamente para a fila do Cadastro para nova análise.

Sem outras alterações: numeração dos demais passos (2️⃣/3️⃣/4️⃣) e links continuam iguais; nenhum código de fluxo é tocado, é puramente conteúdo do tutorial.
