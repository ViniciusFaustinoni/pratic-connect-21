## Objetivo

Corrigir os 3 buracos da edge `cancelar-troca-titularidade` antes do próximo teste e aplicar correções retroativas no KOU6D37 e nos 2 documentos Autentique já cancelados. Os pontos 4–7 da auditoria ficam registrados como dívida técnica e NÃO entram nesta entrega.

---

## Fix 1 — Limpeza completa dos campos do veículo

**Arquivo:** `supabase/functions/cancelar-troca-titularidade/index.ts`, etapa `limpar_veiculo` (hoje só zera `em_troca_titularidade`).

Atualizar o UPDATE em `veiculos` para também zerar:
- `troca_titularidade_id = null`
- `troca_titularidade_iniciada_em = null`

Manter como best-effort (try/catch com warn) — não bloqueia o cancelamento, mesma política atual.

**Retroativo (migração de dados):** UPDATE no veículo `9e42bc9b…` (KOU6D37) zerando `troca_titularidade_id` e `troca_titularidade_iniciada_em` (que ainda apontam para `af5d46d0…`). Auditar antes/depois via SELECT no log de aplicação.

---

## Fix 2 — Religação da cobertura

**Contexto descoberto:** quando a troca suspende cobertura (via `autentique-webhook` e `autentique-sync-termo-cancelamento`), grava `veiculos.cobertura_suspensa_motivo = 'troca_titularidade_em_andamento'`. Esse campo é a prova segura de que a suspensão foi causada pela troca — exatamente o critério que você pediu.

Acrescentar nova etapa `religar_cobertura` na edge, depois do `limpar_veiculo`:

- SELECT em `veiculos` para ler `cobertura_suspensa` e `cobertura_suspensa_motivo`
- Se `cobertura_suspensa = true` AND `cobertura_suspensa_motivo = 'troca_titularidade_em_andamento'`:
  - UPDATE `cobertura_suspensa = false`, `cobertura_suspensa_em = null`, `cobertura_suspensa_motivo = null`
- Qualquer outro motivo (inadimplência, instalação pendente, manual) → NÃO toca. Loga `religação ignorada (motivo=X)`.

Best-effort com warn, igual às outras etapas.

**Retroativo:** mesmo critério aplicado no `9e42bc9b…` (MARCOS / KOU6D37) — religar somente se o motivo for `troca_titularidade_em_andamento`. Se for outro motivo, parar e reportar para decisão manual.

---

## Fix 3 — Revogação do termo no Autentique

**Contexto descoberto:** já existe a edge `autentique-cancel` que faz `mutation { deleteDocument(id: "...") }`. Não precisa reimplementar GraphQL.

Acrescentar nova etapa `revogar_termo` na edge:

- Ler `termo_cancelamento_autentique_id` da solicitação (já está no SELECT inicial — incluir o campo).
- Se houver ID, chamar `autentique-cancel` via `admin.functions.invoke('autentique-cancel', { body: { documentId } })`.
- Best-effort com warn — não bloqueia. Loga sucesso/falha com o ID do documento.

**Retroativo:** invocar `autentique-cancel` manualmente para:
- `a740c4cc…` (solicitação `af5d46d0…`)
- `c3a7b0e2…` (solicitação `77979cf3…`)

Confirmar no painel Autentique que os 2 documentos saíram do estado "pendente".

---

## Detalhes técnicos

### Ordem das etapas na edge (após o fix)
```
1. update_solicitacao  (status=cancelada, reprovado_*)
2. limpar_veiculo      (em_troca_titularidade=false, troca_titularidade_id=null, troca_titularidade_iniciada_em=null)
3. religar_cobertura   (NOVA — condicional ao motivo)
4. revogar_termo       (NOVA — invoca autentique-cancel)
5. cancelar_cotacao    (espelho, rotaciona token)
6. cancelar_contrato   (derivado)
7. whatsapp            (best-effort)
```

### Migração retroativa (SQL via insert tool)
Dois UPDATEs no `veiculos` para `9e42bc9b…`:
- Limpeza dos 2 campos de troca (sempre).
- Religação de cobertura SOMENTE se `cobertura_suspensa_motivo = 'troca_titularidade_em_andamento'` (WHERE clause garante segurança).

Antes de rodar: SELECT do estado atual para registro. Depois: SELECT de validação.

### Autentique retroativo
Duas chamadas isoladas a `autentique-cancel` com os 2 documentos. Pode ser feito via `supabase--curl_edge_functions`.

### O que NÃO está nesta entrega (dívida técnica registrada)
- Trigger `trg_auditoria_generica` em `solicitacoes_troca_titularidade`
- Front duplicando POST por clique
- Investigação do `termo_whatsapp_status=falhou` nos 2 envios
- Refatoração do schema (`reprovado_*` vs campos próprios de cancelamento)

---

## Validação pós-deploy

1. KOU6D37 (`9e42bc9b…`): `em_troca_titularidade=false`, `troca_titularidade_id=null`, `troca_titularidade_iniciada_em=null`, `cobertura_suspensa=false` (se motivo era troca).
2. Documentos `a740c4cc…` e `c3a7b0e2…` removidos/cancelados no painel Autentique.
3. Próximo teste de troca cancelada deve, sozinho, deixar todos esses campos limpos + revogar o termo, sem ação manual.
