

# Exclusão de cotação pelo próprio vendedor — plano seguro

## Situação atual

A exclusão de cotações já existe via edge function `delete-cotacao`, que faz cascata completa (contratos, serviços, instalações, vistorias, etc.). Porém:

1. A permissão `canDeleteCotacao` é restrita a diretores
2. A edge function exige essa permissão para qualquer exclusão
3. O botão "Excluir" na tabela só aparece para quem tem `cotacao.canDelete`

## Problema

Um vendedor que criou uma cotação errada, duplicada ou cancelada não consegue removê-la. Isso gera poluição na lista e desorganização.

## Solução proposta: exclusão condicional pelo criador

Permitir que o **próprio vendedor** exclua cotações **que ainda não geraram contrato ativo/assinado**, mantendo a exclusão irrestrita (com cascata total) apenas para diretores.

### Regras de negócio

- **Vendedor pode excluir**: cotações que ele criou (`vendedor_id = user_id`) **E** que não tenham contrato com status `assinado` ou `ativo`
- **Diretor pode excluir**: qualquer cotação (comportamento atual mantido)
- Motivo obrigatório em ambos os casos (já implementado no dialog)
- Log de auditoria registra quem excluiu (já implementado na edge function)

### Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/delete-cotacao/index.ts` | **Editar** — aceitar exclusão pelo próprio vendedor quando cotação não tem contrato ativo |
| `src/pages/vendas/Cotacoes.tsx` | **Editar** — ajustar `getPermissions` para permitir exclusão pelo dono |
| `src/pages/vendas/CotacaoDetalhe.tsx` | **Verificar** — garantir que o botão excluir respeita a mesma lógica |

### Detalhes técnicos

**1. Edge function `delete-cotacao` (alteração principal)**

Trocar a verificação rígida de `has_permission('canDeleteCotacao')` por lógica dual:

```
SE tem permissão canDeleteCotacao → permite (diretor)
SENÃO SE vendedor_id da cotação == userId:
  - Verificar se cotação NÃO tem contrato ativo/assinado
  - Se não tem → permite exclusão
  - Se tem → bloqueia com mensagem clara
SENÃO → bloqueia (sem permissão)
```

**2. Frontend `Cotacoes.tsx` — ajuste na linha 577**

A permissão `canDelete` por cotação já considera `isOwner`:
```typescript
canDelete: permissions.cotacao.canDelete || (isOwner && !['assinado', 'ativo'].includes(cotacao.contrato?.status || ''))
```
Isso já está correto — o botão aparece para o dono quando não há contrato ativo. A única mudança necessária é no backend (edge function) que hoje bloqueia mesmo sendo dono.

**3. Nenhuma migration necessária**

Não há alteração de schema. A lógica toda é resolvida na edge function existente.

### Fluxo resultante

```text
Vendedor clica "Excluir" na cotação que ele criou
  │
  ├── Cotação sem contrato ativo → Dialog pede motivo → Edge function executa cascata → Sucesso
  ├── Cotação com contrato ativo/assinado → Botão nem aparece (frontend já filtra)
  └── Cotação de outro vendedor → Botão nem aparece (frontend já filtra)

Diretor clica "Excluir" em qualquer cotação
  └── Dialog pede motivo → Edge function executa cascata → Sucesso (sem restrição)
```

