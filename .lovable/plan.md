## Cruzamento: fluxo canônico Sub-FIPE × o que aconteceu em `COT-20260516-094716657-965`

Veículo: moto, chassi `9C6DG334050043147`, FIPE **R$ 27.948** (< R$ 30k → sub-FIPE, dispensa rastreador). Associado: FRANCISCO ERIVALDO TEIXEIRA.

| # | Etapa canônica (sub-FIPE) | O que aconteceu | OK? |
|---|---------------------------|-----------------|-----|
| 1 | Escolha do plano | 12:47 `plano_escolhido` | ✅ |
| 2 | Envio de documentos | 12:49 `documentos_ok` | ✅ |
| 3 | Assinatura do termo (sem rastreador) | 14:19 `contrato_assinado` (Autentique) | ✅ |
| 4 | Pagamento (se houver) | (adesão sem pagto neste caso) | — |
| 5 | **Autovistoria 31/15** com mesma estrutura do técnico | 14:27 `finalizar-autovistoria-cotacao` criou `vistoria` (pendente) + `servico` `vistoria_entrada` (em_analise) + bumpou cotação para `aguardando_aprovacao_cadastro` | ✅ |
| 6 | **Vai para o Cadastro** | Entrou na fila — Alessandra (Cadastro) abriu o caso 15:14 | ✅ até aqui |
| 6.1 | Cadastro pode "Aprovar / Solicitar Docs / Reprovar"; ao **solicitar docs**, libera R/F só no Aprovar | Alessandra clicou **"Solicitar Documentos"** → `associados.status: pendente_vistoria → documentacao_pendente` | ❌ efeito colateral |
| 7 | Após Cadastro aprovar → vai para Monitoramento decidir vistoria/aprovar | **NUNCA chegou** porque o caso sumiu das filas | ❌ |
| 8 | Monitoramento aprova ou pede vistoria de técnico (só fotos) → vistoria → reaprovação | bloqueado | ❌ |
| 9 | `ativar-associado` → SGA | bloqueado | ❌ |

## Causa raiz (auditada no banco)

A trigger `trg_recompute_cotacao_from_associado` em `public.associados` chama `public.recompute_cotacao_status_contratacao(cotacao_id)` em **qualquer** mudança de `associados.status`. A função recalcula `status_contratacao` por uma hierarquia que **não conhece os estados pós-autovistoria do fluxo sub-FIPE**:

```
cancelado > veiculo_recusado > ativo
  > vistoria_agendada (instalacao agendada + adesao_paga)
  > pagamento_ok
  > contrato_assinado          ← cai aqui (contrato.status='assinado')
  > vistoria_ok / documentos_ok / dados_preenchidos / plano_escolhido
```

`aguardando_aprovacao_cadastro` e `aguardando_aprovacao_monitoramento` **não estão na hierarquia**. Quando o Cadastro clica "Solicitar Documentos" (no fluxo sub-FIPE essa ação está prevista e correta), o `useSolicitarDocumentos` atualiza apenas `associados.status` — e a trigger rebobina silenciosamente `cotacoes.status_contratacao` para `contrato_assinado`.

Efeitos colaterais (todos observados):
1. Caso sai da fila "Aprovação do Cadastro" (filtra `aguardando_aprovacao_cadastro`).
2. Link público volta para **1/6 — Escolha do Plano** (o componente lê `status_contratacao` para escolher a etapa) → cliente vê tela do print.
3. Caso nunca chega ao Monitoramento → veículo fica permanentemente em `instalacao_pendente`, sem cobertura R/F.

O mesmo bug atingiu o caso do Rian (`COT-20260515-123812646-121`) ontem — qualquer toque em `associados.status` (Cadastro aprovando, solicitando docs, blacklist, etc.) zera o avanço do fluxo sub-FIPE.

## Plano de correção

### 1. Migration — patch idempotente em `recompute_cotacao_status_contratacao`

Adicionar guard no início da função: se `v_current ∈ ('aguardando_aprovacao_cadastro','aguardando_aprovacao_monitoramento','vistoria_concluida')` **e** o contrato não está `cancelado` **e** o associado não está `cancelado/recusado` → preserva `v_current` (não recomputa). Demais ramos continuam idênticos para não afetar o fluxo comum.

Resultado: o Cadastro pode mover `associados.status` livremente (em_analise ↔ documentacao_pendente ↔ pendente_vistoria) sem desfazer o avanço do fluxo de cotação.

### 2. Migration — backfill controlado dos casos travados

Para toda cotação onde:
- existe `vistorias` com `origem='autovistoria_publica'` materializada (vistoria + servico vinculados via `vistoria_origem_id`),
- `cotacoes.status_contratacao = 'contrato_assinado'`,
- contrato NÃO `cancelado` e associado NÃO `cancelado/recusado`,
- `contratos.cadastro_aprovado = false`,

→ `UPDATE cotacoes SET status_contratacao = 'aguardando_aprovacao_cadastro'` + 1 linha em `logs_auditoria` (`acao='backfill_status_pos_autovistoria'`).

Cobre `COT-20260516-094716657-965` e qualquer outro caso silenciosamente travado pelo mesmo bug.

### 3. Sanity — etapas 7 e 8 do fluxo

A função `useSolicitarDocumentos`, `useReprovarProposta` e `useAprovarPropostaCadastro` **não** mexem em `status_contratacao` por design — quem governa esse campo no fluxo sub-FIPE é a edge `finalizar-autovistoria-cotacao` (etapa 5) e a `aprovar-proposta` (etapa 6 → setta `aguardando_aprovacao_monitoramento`). Com o patch do item 1, a transição passa a ficar estável. Nenhuma mudança nesses hooks/edges é necessária.

### 4. Memória

Criar `mem://logic/quotation/recompute-cotacao-preserva-pos-autovistoria.md` com a invariante: "`recompute_cotacao_status_contratacao` preserva `aguardando_aprovacao_cadastro` / `aguardando_aprovacao_monitoramento` / `vistoria_concluida` quando o contrato não está cancelado — qualquer mudança em `associados.status` é segura".

Adicionar entrada em `mem://index.md` Memories.

### 5. Validação (executada após migration)

- `SELECT numero, status_contratacao FROM cotacoes WHERE numero IN ('COT-20260516-094716657-965','COT-20260515-123812646-121')` → ambos devem voltar a `aguardando_aprovacao_cadastro` (se ainda elegíveis).
- Conferir no painel "Cadastro › Propostas Pendentes" se `COT-...965` reaparece para Alessandra.
- Browser no link público da cotação → deve sair de "1/6 Escolha do Plano" e mostrar a etapa de "Aguardando análise do Cadastro" / próxima etapa correta.
- Smoke: manualmente alterar `associados.status` (em_analise → documentacao_pendente → em_analise) e confirmar que `cotacoes.status_contratacao` permanece `aguardando_aprovacao_cadastro`.

## Arquivos / objetos tocados

- `supabase/migrations/<novo>_recompute_cotacao_preserva_pos_autovistoria.sql` — `CREATE OR REPLACE FUNCTION recompute_cotacao_status_contratacao` + `UPDATE` de backfill + `INSERT` em `logs_auditoria`.
- `mem://logic/quotation/recompute-cotacao-preserva-pos-autovistoria.md` (novo).
- `mem://index.md` (1 linha em Memories).

## Não escopo

- Não alterar `useSolicitarDocumentos`, `useReprovarProposta`, `useAprovarPropostaCadastro`, `aprovar-proposta`, `finalizar-autovistoria-cotacao` ou qualquer trigger relacionada — o problema é exclusivamente da função SQL de recompute.
- Não tocar em `trg_protege_cadastro_aprovado` (já cobre outro vetor).
- Não criar tela nova; a UI atual de Cadastro/Monitoramento já está correta — só precisa que o estado persista.
