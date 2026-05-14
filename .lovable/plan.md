## Nova fonte de dados da Régua: API Hinova `/listar/boleto-associado/periodo`

Hoje a régua varre as tabelas locais (`asaas_cobrancas` + `cobrancas` origem `sga_hinova`). Vamos trocar essa fonte pelo endpoint Hinova, que já entrega tudo o que a régua precisa em um único JSON: nome do associado, celular, e‑mail, vencimento, status do boleto, linha digitável, placa/modelo do veículo, valor, etc.

Sem mexer em nada do CSV (Importar CSV continua funcionando independente).

---

## 1. Wrapper Hinova `listarBoletosPorPeriodo`

Em `supabase/functions/_shared/hinova-client.ts`, adicionar:

- `listarBoletosPorPeriodoJanela(s, { dataInicial, dataFinal, codigoSituacaoBoleto?, paginaInicio?, qtdPorPagina? })` → uma chamada POST para `/listar/boleto-associado/periodo`. Trata 404/406 vazios igual ao wrapper de veículo. Retorna `{ boletos, pagina_corrente, numero_paginas, total_registros }`.
- `listarBoletosPorPeriodo(s, { dataInicial, dataFinal, codigoSituacaoBoleto? })` → orquestra:
  - Fatia o intervalo em janelas de **31 dias** (limite oficial da Hinova);
  - Em cada janela, pagina (`inicio_paginacao` 0,1,2…) até esgotar `numero_paginas`, com `quantidade_por_pagina = 200` e `link_boleto: true`;
  - Deduplica por `nosso_numero`.

Reutiliza `withHinovaAuthRetry` e respeita os erros transitórios do client (já estabelecidos no projeto).

---

## 2. Edge function `executar-regua-cobranca` — refatorada

Mantém o nome (UI continua chamando o mesmo endpoint), mas troca o motor:

### 2.1. Cálculo da janela
- Lê as etapas ativas da régua.
- `dMin = min(etapa.dias)` (mais negativo, ex.: ‑15) e `dMax = max(etapa.dias)` (ex.: +61).
- Janela de varredura: `data_vencimento` entre `hoje + dMin` e `hoje + dMax`. Se exceder 31 dias, fatia automaticamente.

### 2.2. Identificação de status
Para cada boleto retornado, classifica usando `codigo_situacao_boleto` + `data_pagamento`:
- **PAGO** (`data_pagamento` preenchida ou situação "pago/baixado") → ignora.
- **CANCELADO** → ignora.
- **VENCIDO** (sem pagamento e `data_vencimento < hoje`) → entra na régua de cobrança.
- **A VENCER** (sem pagamento e `data_vencimento >= hoje`) → entra como lembrete.

### 2.3. Casamento boleto ↔ etapa
Para cada boleto não‑pago, calcula `offset = floor((data_vencimento − hoje) / 1d)`:
- `offset > 0` → procura etapa com `dias === −offset` (ex.: vence em 6 dias → etapa D‑6).
- `offset <= 0` → procura etapa com `dias === |offset|` (ex.: venceu há 5 dias → etapa D+5). Se não houver etapa exata, usa a maior etapa cujo `dias <= |offset|` (assim D+5..D+10 caem na mais próxima configurada).

### 2.4. Fila ordenada e dedupe
Monta `fila[]` ordenada por:
1. `diasAtraso DESC` (inadimplentes mais antigos primeiro);
2. `valor_boleto DESC` (desempate);
3. depois os "a vencer" do mais próximo do vencimento ao mais distante.

Antes de enfileirar, dedupe por `(nosso_numero, etapa.dias, dia_civil_SP)` consultando `cobranca_eventos` (chave em `dados.nosso_numero`). Boleto já disparado hoje para a mesma etapa é pulado.

### 2.5. Disparo com delay de 10s
Para cada item da fila:
- Monta contexto a partir do JSON Hinova: `nome_associado`, `celular` (fallback `telefone_fixo`/`telefone_comercial`), `valor_boleto`, `data_vencimento`, `linha_digitavel`, `placa`/`modelo` do primeiro item de `veiculos[]`, `email`.
- Sanitiza telefone (remove máscara, prefixa 55 quando faltar).
- Chama `whatsapp-send-text` com o template configurado.
- Grava `cobranca_eventos` com `dados.nosso_numero`, `dados.codigo_associado`, `dados.codigo_veiculo`, `dados.dia_regua`, `dados.dias_atraso`, `dados.status`, `dados.message_id`, `dados.fonte = 'hinova_periodo'`.
- `await sleep(delayMs)` entre cada envio. **`delayMs` configurável** no body da edge (default 10 000).

### 2.6. Execução em background (sem travar a UI)
Edge functions têm timeout finito (~150s). Com 10s/envio, isso só serve para ~14 disparos. Para volumes reais usamos `EdgeRuntime.waitUntil(...)` para processar a fila em segundo plano e devolver imediatamente para a UI:

```text
1. Edge cria registro `cobranca_run` (id, started_at, total_planejado, status='executando').
2. Devolve { run_id, total_planejado } em <2s.
3. Em background, processa a fila chamando whatsapp-send-text + sleep(10s),
   atualizando `cobranca_run` (enviados, falhas, atual_idx) a cada N envios.
4. Cada envio também grava cobranca_eventos como hoje.
```

Tabela nova `cobranca_runs`:
- `id uuid`, `started_at`, `finished_at`, `status` (`executando`/`concluido`/`falhou`/`cancelado`),
- `total_planejado int`, `enviados int`, `falhas int`, `pulados int`,
- `delay_ms int`, `criado_por uuid`, `payload jsonb` (snapshot dos contadores e janela).

### 2.7. Fonte secundária / fallback
Se a chamada Hinova falhar (transitório), a edge devolve erro e NÃO cai para `cobrancas` locais. Isso evita disparos com dados desatualizados. (Ver pergunta 1 abaixo.)

---

## 3. UI (`ReguaCobranca.tsx`)

Mudanças mínimas:
- Botão **"Executar agora"** continua igual, mas o body envia `{ delayMs: 10000 }` (lê de um campo opcional na UI — input "Intervalo entre envios (s)" default 10).
- Após o invoke, recebe `{ run_id, total_planejado }` e abre um painel "Execução em andamento" que faz polling em `cobranca_runs` por `run_id` mostrando: **N de M enviados • F falhas • P pulados • ETA ~Xmin** com barra de progresso.
- Botão "Cancelar" marca `cobranca_runs.status='cancelado'` e o loop de background respeita o flag a cada iteração.
- Card "Falhas SGA (linha digitável ausente)" continua igual; agora também detecta linha digitável ausente vinda direto do JSON Hinova.

---

## 4. Idempotência e segurança

- **Mesmo dia, mesmo boleto, mesma etapa** → não dispara duas vezes (chave: `nosso_numero + etapa.dias + dia_civil_SP`).
- Régua DESATIVADA continua bloqueando tudo (já implementado).
- Limite máximo por execução `REGUA_MAX_DISPAROS_POR_RUN` (env, default 1000).
- Honra suppression list de WhatsApp (já tratada por `whatsapp-send-text`).

---

## 5. Migration

```sql
CREATE TABLE public.cobranca_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'executando',
  total_planejado int NOT NULL DEFAULT 0,
  enviados int NOT NULL DEFAULT 0,
  falhas int NOT NULL DEFAULT 0,
  pulados int NOT NULL DEFAULT 0,
  delay_ms int NOT NULL DEFAULT 10000,
  criado_por uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.cobranca_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internos leem runs" ON public.cobranca_runs
  FOR SELECT USING (auth.role() = 'authenticated');
-- writes apenas via edge (service role) → sem policy de INSERT/UPDATE.
```

Índice em `cobranca_eventos.dados->>'nosso_numero'` para acelerar o dedupe diário.

---

## 6. Arquivos tocados

- `supabase/functions/_shared/hinova-client.ts` — adiciona `listarBoletosPorPeriodo*`.
- `supabase/functions/executar-regua-cobranca/index.ts` — refatora motor (Hinova-first + background + delay).
- `src/pages/cobranca/ReguaCobranca.tsx` — input de delay, painel de progresso, botão cancelar.
- `src/integrations/supabase/types.ts` — atualizado pela migration (auto).
- Migration: cria `cobranca_runs` + índice de dedupe.

---

## Pergunta antes de implementar

1. **Quando a Hinova falhar (timeout/janela horária)**, prefere que a régua:
   - **(a)** aborte e devolva erro pra UI, OU
   - **(b)** caia automaticamente nas tabelas locais (`asaas_cobrancas` + `cobrancas`) como hoje, marcando o run como "fonte=fallback_local"?

Tudo o resto segue com defaults sensatos (delay 10s, ordenação inadimplentes→a vencer, dedupe diário, background com painel de progresso). Se quiser ajustar algum default, é só dizer.
