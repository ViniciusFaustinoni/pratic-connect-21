# Diagnóstico

Cotação `COT-20260521-002944030-565` (placa **KOU6D37**, sol `bb49bf56…`):

- `cotacoes`: `tipo_entrada=troca_titularidade`, `origem_troca_titularidade=true`, `dados_extras.solicitacao_troca_id=bb49bf56…`, `dados_extras.associado_antigo_id=9c05d3c4…` — tudo correto.
- `solicitacoes_troca_titularidade`: `status='cotacao_em_andamento'`, `termo_cancelamento_assinado_em=2026-05-20 21:15` — termo do antigo titular já assinado.
- `veiculos KOU6D37`: `troca_titularidade_id=bb49bf56…`, `associado_id=9c05d3c4…` (antigo), **mas `em_troca_titularidade=false`**.

`contrato-gerar` → `placaLiberadaPorTrocaTitularidade` exige `em_troca_titularidade=true` como primeiro filtro (linha 60). Como está `false`, retorna `false` antes de avaliar match por sol/antigo titular → cai no 409 `PLACA_DE_OUTRO_ASSOCIADO` que o cliente está vendo.

O webhook do Autentique (`autentique-webhook/index.ts` linhas 339‑369) seta `em_troca_titularidade=true` + `troca_titularidade_id` no mesmo UPDATE quando o termo de cancelamento é assinado. A presença de `troca_titularidade_id` e ausência da flag indica drift: ou o UPDATE foi parcialmente sobrescrito depois (trigger de sync de veículo, outra edge), ou o webhook rodou em versão antiga. O resto da cadeia funcional (`fn_sync_veiculo_associado_from_contrato`, `placa_bloqueada_por_troca`, `efetivar-troca-titularidade`) usa `troca_titularidade_id` como verdade — só esse guard ainda trata a flag como condição dura.

# Plano

## 1. Endurecer `placaLiberadaPorTrocaTitularidade` (raiz)

Em `supabase/functions/contrato-gerar/index.ts`:

- Remover a exigência de `em_troca_titularidade=true` como gate inicial. Tratar `troca_titularidade_id` como verdade canônica (alinhado com o que o resto do sistema já faz).
- Liberar quando **ambas** condições baterem:
  1. `veiculos.troca_titularidade_id == cotacao.dados_extras.solicitacao_troca_id` (ou match por `associado_antigo_id`, como já existe).
  2. `solicitacoes_troca_titularidade.termo_cancelamento_assinado_em IS NOT NULL` **e** `status NOT IN ('efetivada','expirada','cancelada','recusada')`.
- Quando o bypass for concedido com `em_troca_titularidade=false`, fazer **backfill defensivo** (UPDATE setando a flag + log `[bypass-troca][backfill]`) — idempotente, corrige drift silenciosamente para os próximos passos do fluxo.

Isso transforma `em_troca_titularidade` em sinal/cache, não em trava — consistente com o restante do código.

## 2. Backfill pontual do veículo bloqueado

Migration de dados única em `veiculos` para `placa='KOU6D37'`: `em_troca_titularidade=true` (mantém os demais campos). Destrava a cotação imediatamente sem esperar o deploy do hardening.

## 3. Validação

- Re-disparar `contrato-gerar` para `cotacao_id=74ddd6f0-db20-4921-ad8a-e6df5b75b6ae` via `supabase--curl_edge_functions` e confirmar 200 (contrato + termo gerados).
- Verificar no DB que `contrato.cotacao_id` aponta para a cotação e que `solicitacoes_troca_titularidade.cotacao_id` está vinculado.

## 4. Investigação curta da regressão (sem mexer em código novo)

Rodar uma única query nos logs (`postgres_logs` últimos 7 dias) procurando UPDATEs em `veiculos` que zerem `em_troca_titularidade` após o webhook. Resultado vai para a memória como nota — se aparecer um trigger/edge culpado, abrimos item próprio. Se não aparecer, fica documentado que o hardening do passo 1 já é suficiente porque desacopla o fluxo dessa flag.

# Detalhes técnicos

**Arquivos tocados:**
- `supabase/functions/contrato-gerar/index.ts` — função `placaLiberadaPorTrocaTitularidade` (linhas 49‑82) + log no caller (linha 583).
- Migration: `UPDATE veiculos SET em_troca_titularidade=true, updated_at=now() WHERE placa='KOU6D37' AND troca_titularidade_id='bb49bf56-d19f-47ef-bdad-1e748f51541e' AND em_troca_titularidade=false;`

**Não toca:**
- `efetivar-troca-titularidade`, `autentique-webhook`, triggers DB de sync de veículo — comportamento canônico mantido (continuam podendo escrever `em_troca_titularidade=true`; agora `contrato-gerar` apenas não depende mais disso).
- Memória `troca-titularidade-desvinculo-logico` continua válida; vou adicionar nota sobre a flag ser sinal e não trava.

# Riscos

- Risco baixo: o bypass continua exigindo termo de cancelamento assinado + sol não-terminal + match de id/antigo titular. Ou seja, mantém todas as travas anti-sequestro reais; só tira a dependência de uma flag derivada.
- Backfill pontual é estritamente data-only e idempotente.

Aprovação para implementar nesta ordem (1 → 2 → 3 → 4)?
