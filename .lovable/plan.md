

# Plano: Estorno Individual de Comissão Paga

## Resumo

Implementar fluxo completo de estorno manual para comissões individuais já pagas, com modal de motivo obrigatório, geração de débito, auditoria e card de resumo no dashboard.

## Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `src/components/financeiro/EstornoComissaoModal.tsx` | **Criar** — Modal de estorno |
| `src/hooks/useContaCorrenteVendedor.ts` | **Modificar** — Adicionar mutation `estornarComissao` |
| `src/pages/financeiro/GestaoContaVendedor.tsx` | **Modificar** — Botão de estorno + tooltip de motivo |
| `src/hooks/useDashboardVendaExterna.ts` | **Modificar** — Adicionar query de estornos no mês |
| `src/pages/financeiro/DashboardVendaExterna.tsx` | **Modificar** — Card "Estornos no mês" |

## Detalhamento

### 1. Modal `EstornoComissaoModal.tsx`

Novo componente Dialog com:
- Props: `open`, `onClose`, `lancamento` (CCLancamento), `vendedorNome`, `onConfirm`, `isSaving`
- Exibe resumo: vendedor, descrição, valor líquido, data pagamento
- Campo `Textarea` para motivo (mínimo 10 caracteres)
- Aviso fixo: "Esta ação não pode ser desfeita. O vendedor será notificado automaticamente com o motivo informado."
- Botão "Confirmar estorno" (variant destructive) desabilitado se motivo < 10 chars
- Botão "Cancelar"

### 2. Mutation `estornarComissao` no hook

No `useContaCorrenteVendedor.ts`, adicionar mutation que:

1. Atualiza o lançamento original:
   - `status: 'cancelado'`
   - `observacao_pagamento: motivo`
   - `pago_por: profile.id` (reutilizando campo para auditoria de quem estornou)
   - `updated_at: now()`

2. Insere novo lançamento de débito:
   - `tipo: 'debito'`
   - `categoria: 'estorno'`
   - `descricao: 'Estorno — [descrição original]'`
   - `valor_bruto/valor_liquido`: mesmo valor do original
   - `status: 'a_pagar'`
   - `debito_volante_ref_id: id do lançamento original` (referência)

3. Chama `recalcularSaldos`

O trigger `trg_notificar_pagamento` cuida da notificação automaticamente ao detectar `status → cancelado`.

### 3. Botão na tabela `GestaoContaVendedor.tsx`

- Importar `usePermissions` para obter `isDiretor`
- Na coluna "Ações", quando `l.status === 'pago' && l.tipo === 'credito'` e `isDiretor === true`: exibir botão "Estornar" (ícone RotateCcw, variant ghost destructive)
- Na coluna "Status", quando `l.status === 'cancelado'`: exibir badge "Estornado" e tooltip com `l.observacao_pagamento` ao hover
- Importar e renderizar `EstornoComissaoModal`

### 4. Card no Dashboard

No `useDashboardVendaExterna.ts`:
- Adicionar query para somar `valor_liquido` de lançamentos com `categoria = 'estorno'`, `tipo = 'debito'`, criados no mês atual
- Expor `estornos_mes` e `estornos_count` no `DashboardCards`

No `DashboardVendaExterna.tsx`:
- Adicionar 5º card "Estornos no mês" com ícone `RotateCcw`, cor vermelha, exibindo total e quantidade

### 5. Controle de permissão

O botão de estorno será visível apenas quando `isDiretor` for `true` (perfis `diretor` ou `gerente_comercial` conforme `isGerencia`). O hook `usePermissions` já deriva essa flag dos roles do banco. Vendedores e supervisores não verão o botão.

