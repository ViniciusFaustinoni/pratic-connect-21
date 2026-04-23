

## Cobranças via WhatsApp com dados de pagamento do SGA

### Diagnóstico

A régua já dispara WhatsApp com templates Meta aprovados, **mas envia apenas 3 parâmetros fixos**: `[nome, valor, vencimento]` (em `executar-regua-cobranca/index.ts`, linha ~294). Os templates aprovados na Meta esperam **mais variáveis específicas por estágio**:

| Template | Variáveis esperadas |
|---|---|
| `cobranca_mensalidade` | `{{1}} nome, {{2}} mês/ano, {{3}} vencimento` |
| `d_6_lembrete_desconto_v1` | `{{1}} nome, {{2}} vencimento, {{3}} **linha digitável**` |
| `d0_boleto_vence_hoje_v1` | `{{1}} nome, {{2}} valor, {{3}} vencimento, {{4}} modelo, {{5}} placa, {{6}} **linha digitável**` |
| `d1_a_d4_boleto_vencido_v1` | `{{1}} nome, {{2}} vencimento` |
| `d11_aviso_negativacao_v1` | `{{1}} nome, {{2}} vencimento, {{3}} valor, {{4}} placa` |
| `d12_debito_com_multa_v1` | `{{1}} nome, {{2}} vencimento, {{3}} valor, {{4}} placa` |

Resultado hoje: ou a Meta **rejeita o envio** (quantidade de variáveis errada → erro `132000` "number of parameters does not match"), ou aceita mas o associado recebe a mensagem sem **linha digitável / código de barras / placa**, justamente o que ele precisa para pagar.

### Onde estão os dados de pagamento do SGA

A tabela **`cobrancas`** (origem `sga_hinova`) já é populada pela função `sga-sync-financeiro-veiculo` com os campos vindos do SGA:

- `linha_digitavel` (string)
- `codigo_barras` (string)
- `boleto_url` (link PDF)
- `nosso_numero`
- `valor_final`, `data_vencimento`, `referencia_mes/ano`
- `veiculo_id` (para puxar placa/modelo)
- `origem = 'sga_hinova'`

A régua hoje lê de **`asaas_cobrancas`** (linha 129) — outro universo de dados (Asaas, não SGA). Para associados originados da base antiga (Hinova), os boletos válidos estão em `cobrancas` e nunca são considerados pela régua.

### Mudanças

**A. `supabase/functions/executar-regua-cobranca/index.ts` — buscar de duas fontes e montar variáveis ricas**

1. **Pass 1 e Pass 2: ler de duas fontes** em paralelo:
   - `asaas_cobrancas` (já existe) — para associados pagando via Asaas.
   - `cobrancas` filtrando `origem = 'sga_hinova' AND status IN ('aguardando_pagamento','vencido')` — para associados da base SGA. Selecionar também `linha_digitavel, codigo_barras, boleto_url, valor_final, veiculo_id, referencia_mes, referencia_ano`.
   - Unificar num único `Map<associado_id, info>` mantendo o registro de **maior atraso** (mesma lógica atual de agrupamento) e gravando `fonte: 'sga' | 'asaas'` + `linha_digitavel`, `codigo_barras`, `boleto_url`, `veiculo_id`, `referencia_label` em `info`.

2. **Helper `buildTemplateParams(templateName, contexto)`** com mapa explícito por template aprovado:
   - Lê uma vez do banco `whatsapp_meta_templates.corpo` para descobrir a quantidade real de `{{N}}`.
   - Mapa interno por nome → ordem de variáveis (ex.: `d0_boleto_vence_hoje_v1` → `[nome, valorBRL, vencimentoBR, modelo, placa, linhaDigitavel]`).
   - Fallback genérico: monta `[nome, valorBRL, vencimentoBR, linhaDigitavel || '—', placa || '—']` truncado/preenchido para o número de slots detectado, evitando o erro `132000`.

3. **Buscar veículo (placa + modelo)** em uma query auxiliar quando o template exigir (`veiculo_id` já vem do `cobrancas`/`asaas_cobrancas` — esta última já tem `veiculo_id`).

4. **Persistir os parâmetros usados em `cobranca_eventos.dados`** (`template_params`, `linha_digitavel`, `boleto_url`, `fonte`) — auditoria e debugging.

5. **Fallback de comunicação:** se `linha_digitavel` estiver vazia para um template que a exige, **pular o disparo** e gravar evento `falhou` com motivo `"Sem linha digitável SGA disponível — sincronize o financeiro do veículo"`. Evita enviar mensagem incompleta.

**B. UI `src/pages/cobranca/ReguaCobranca.tsx` — feedback visual sobre variáveis**

- Ao selecionar um template numa etapa, mostrar abaixo do select um **resumo das variáveis que serão preenchidas** lendo de um pequeno `templateParamsMap` (mesmo dicionário compartilhado com a edge function via constante exportada — coloco em `src/lib/cobranca/templateParams.ts` e a edge function duplica o mapa, já que não compartilham módulos).
- Exibir badge de aviso amarelo na etapa quando o template requer linha digitável (`d_6_…`, `d0_…`) — com tooltip "Requer cobrança SGA sincronizada (`origem='sga_hinova'`) com linha digitável preenchida".

**C. Sem mudanças de schema**

Todos os campos necessários já existem (`cobrancas.linha_digitavel`, `codigo_barras`, `boleto_url`). Não há migração.

### Arquivos editados

- `supabase/functions/executar-regua-cobranca/index.ts` — leitura dual (asaas + sga), montagem de variáveis ricas por template, registro detalhado.
- `src/pages/cobranca/ReguaCobranca.tsx` — preview de variáveis + badge de pré-requisito SGA.
- `src/lib/cobranca/templateParams.ts` (novo) — dicionário de mapeamento template → variáveis (consumido só pela UI; a edge function carrega o mesmo mapa inline para não importar de `src/`).

### Validação (após implementação)

1. Login `admin@teste.com / 123456789` → `/cobranca/regua` → confirmar que cada etapa mostra a lista de variáveis esperadas.
2. Forçar um veículo SGA com cobrança vencida (já existem na base) → "Executar agora" → verificar em `cobranca_eventos.dados`: `template_params` deve conter a `linha_digitavel` real.
3. Conferir log de `whatsapp-send-text` mostrando o `components.parameters` com 6 entradas para `d0_boleto_vence_hoje_v1`.
4. Screenshot da UI com o preview de variáveis.

### Riscos

- **Quantidade de variáveis errada** continua sendo a causa #1 de rejeição Meta; o helper genérico com `slice(0, n)` + padding `'—'` blinda contra isso, mas pode mandar `'—'` no lugar de uma placa real se faltar dado — preferível a falhar o envio inteiro.
- **Associado com múltiplas cobranças** (SGA + Asaas): vai vencer a de **maior atraso**. Documento isso em comentário; se virar problema, próxima iteração escolhe por `tipo`.
- **Linha digitável SGA pode estar desatualizada** se o `sga-sync-financeiro-veiculo` não rodou recentemente. Mitigação: o evento `falhou` já orienta sincronizar.

