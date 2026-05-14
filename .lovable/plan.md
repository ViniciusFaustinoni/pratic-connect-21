## Problema

A idempotência atual da edge `disparar-cobranca-csv-meta` só protege **dentro do mesmo lote** (mesmo `lote_id`). Se no mesmo dia o operador importar um segundo CSV (novo lote), os mesmos boletos serão disparados de novo — o associado recebe a mesma cobrança 2x no WhatsApp.

## Objetivo

Garantir que, **dentro do mesmo dia (data civil)**, o sistema nunca dispare o mesmo boleto duas vezes — independente de lote, fonte (CSV / botão manual / cron) ou template (v1 / v2).

## Estratégia de deduplicação

Chave de duplicidade: **`(matricula, linha_digitavel)`** com status `enviado` cujo `enviado_em::date = current_date` em `cobranca_csv_boletos`.

Por que essa chave:
- `linha_digitavel` é única por boleto Hinova → mesmo boleto, mesmo dia = duplicado.
- `matricula` evita colisão acidental entre associados diferentes que tenham linhas iguais por erro de import.
- Janela "dia civil" (`current_date` no fuso `America/Sao_Paulo`) é o que o usuário pediu — mais previsível que "últimas 24h".

Fallback para boletos sem `linha_digitavel` (raro, mas possível em CSV malformado): chave `(matricula, vencimento, valor)` no mesmo dia.

## Mudanças

### 1. Edge function `disparar-cobranca-csv-meta`

Logo após o `INIT_ONLY` retornar e antes do loop de envio (entre as linhas atuais 333 e 467):

a. **Buscar boletos já enviados hoje** (qualquer lote) cujas `linha_digitavel` estejam no chunk atual:
   ```ts
   const linhasChunk = destinatarios.flatMap(d => d.boletos.map(b => b.linha_digitavel)).filter(Boolean);
   const { data: jaEnviadosHoje } = await supabase
     .from("cobranca_csv_boletos")
     .select("matricula, linha_digitavel, lote_id, enviado_em")
     .eq("status", "enviado")
     .gte("enviado_em", inicioDoDiaSP())  // 00:00 fuso SP em ISO UTC
     .in("linha_digitavel", linhasChunk);
   ```
b. Construir `Set<string>` `linhasJaEnviadasHoje` com chave `${matricula}|${linha_digitavel}`.
c. **Filtrar boleto-a-boleto** (não só matrícula-a-matrícula) dentro de cada destinatário antes de chamar `montarBlocosBoletosSegmentados`. Se sobrarem 0 boletos, marcar destinatário inteiro como `skip` com motivo `duplicado_no_dia` e empurrar para `detalhes`.
d. Estender o atual loop de "matriculasJaEnviadas" (linhas 335-353) para **mesclar** as duas regras: pular por matrícula+lote (retomada) **ou** por linha+dia (cross-lote).
e. Registrar nos `detalhes` cada boleto pulado com `erro_codigo: 'duplicado_dia'` e o `lote_id` original em `erro` para auditoria.

### 2. KPI no resultado do envio

Adicionar contador `pulados_duplicidade_dia: number` no JSON de resposta, paralelo ao `pulados_idempotencia` que já existe.

### 3. Frontend `ImportarCobrancaCsv.tsx`

- Acumular `pulados_duplicidade_dia` ao longo dos chunks.
- Na tela "Concluído", exibir um `KpiCard` adicional: **"Pulados (já enviados hoje)"** + badge nos detalhes da tabela com o motivo `duplicado_no_dia`.
- Mostrar um `Alert` informativo no topo do passo 2 (preview) lembrando que boletos disparados hoje em lotes anteriores serão automaticamente pulados.

### 4. Migração — índice de performance

Criar índice em `cobranca_csv_boletos(linha_digitavel, enviado_em)` filtrado por `status='enviado'` para tornar a query de checagem barata (hoje a tabela é varrida por `lote_id`, sem cobrir essa busca cross-lote).

```sql
CREATE INDEX IF NOT EXISTS idx_csv_boletos_dedupe_dia
  ON public.cobranca_csv_boletos (linha_digitavel, enviado_em DESC)
  WHERE status = 'enviado';
```

### 5. Cobertura para outros pontos de disparo

Verificar se existem outras edges/jobs que disparam `cobranca_inadimplencia_pratic*` sem passar por essa função (ex.: dispatcher manual no LoteAtivoCobrancas). Se sim, extrair a checagem para uma função SQL `is_boleto_ja_enviado_hoje(matricula text, linha text)` e chamá-la de todos os pontos. Caso contrário, manter inline na edge.

## Resumo

| Camada | Antes | Depois |
|---|---|---|
| Idempotência | Por `lote_id` | Por `lote_id` **+** `(matricula, linha_digitavel)` no mesmo dia civil |
| Granularidade | Matrícula inteira | Boleto-a-boleto |
| Janela cross-lote | Nenhuma | `enviado_em::date = current_date` (fuso SP) |
| Visibilidade | `pulados_idempotencia` | + `pulados_duplicidade_dia` na UI e detalhes |

## Riscos / pontos de atenção

- **Fuso horário**: `enviado_em` é UTC. Calcular o início do dia SP em UTC (ex.: `03:00Z` no horário padrão) para evitar pular boletos enviados após 21h SP do dia anterior. Vou usar `new Date().toLocaleString('en-CA', { timeZone: 'America/Sao_Paulo' })` para derivar a data civil SP.
- **Reprocessamento legítimo**: se o operador realmente quiser reenviar (ex.: corrigir uma falha), precisará esperar o próximo dia. Aceitável segundo a regra pedida; opcional adicionar override `forcar_reenvio: true` no body — **não vou adicionar agora** a menos que você confirme.
- **Boletos sem `linha_digitavel`**: usar fallback `(matricula, vencimento, valor)` para não deixar brecha.
