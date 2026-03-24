

# Plano: Exclusão de cotação pelo usuário (organização)

## Situação atual

O sistema **já possui** toda a infraestrutura de exclusão:

- Edge Function `delete-cotacao` com cascata completa (agendamentos, serviços, instalações, vistorias, contratos, documentos, comissões, cobranças)
- Lógica de permissão: **diretor** pode excluir qualquer cotação; **dono** (vendedor) pode excluir as suas, desde que não tenha contrato ativo/assinado
- UI com botão de exclusão nos componentes `CotacoesTable`, `CotacaoCard` e `CotacaoDetalhe`
- Dialog de confirmação com motivo obrigatório (`ConfirmacaoExclusaoCotacaoDialog`)

## O que precisa ser ajustado

O botão de exclusão na UI está **condicionado à permissão `canDeleteCotacao`** (perfil Diretor). Usuários comuns não veem o botão, mesmo sendo donos da cotação. A edge function já aceita donos, mas a UI bloqueia.

### Arquivo: `src/pages/vendas/Cotacoes.tsx`

Atualmente o botão de excluir só aparece se `hasPerm('canDeleteCotacao')`. Ajustar para mostrar também quando o usuário é o vendedor da cotação e o status não é `contrato_assinado`/`contrato_ativo`.

### Arquivo: `src/components/cotacoes/CotacoesTable.tsx`

Mesma lógica: o item "Excluir" no dropdown menu deve aparecer para o dono da cotação (comparando `vendedor_id` com o `user.id` do contexto de auth), com restrição de status.

### Arquivo: `src/components/cotacoes/CotacaoCard.tsx`

Idem ao anterior — garantir que o card mobile também mostre a opção.

### Arquivo: `src/pages/vendas/CotacaoDetalhe.tsx`

A página de detalhe já tem o botão, mas condicionado a `isDiretor`. Expandir para incluir donos.

## Regras de negócio

| Quem | Pode excluir | Condição |
|------|-------------|----------|
| Diretor (`canDeleteCotacao`) | Qualquer cotação | Sem restrição |
| Vendedor (dono) | Suas próprias cotações | Sem contrato ativo/assinado vinculado |
| Outro usuário | Não | — |

A edge function já implementa exatamente essas regras. A mudança é apenas na **visibilidade do botão** no frontend.

## Alterações

| Arquivo | Ação |
|---------|------|
| `src/pages/vendas/Cotacoes.tsx` | Mostrar botão excluir para dono da cotação (sem contrato ativo) |
| `src/components/cotacoes/CotacoesTable.tsx` | Receber `currentUserId` e mostrar "Excluir" para donos |
| `src/components/cotacoes/CotacaoCard.tsx` | Idem |
| `src/pages/vendas/CotacaoDetalhe.tsx` | Expandir condição do botão para incluir dono |

## Segurança

Nenhuma mudança na edge function. A validação server-side já existe e bloqueia:
- Usuários não autenticados
- Usuários sem permissão e que não são donos
- Donos tentando excluir cotação com contrato ativo

O frontend apenas passa a refletir corretamente o que o backend já permite.

