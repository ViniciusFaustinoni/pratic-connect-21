

# Adicionar tooltip "Excluir" com motivo quando sem permissão

## Contexto

Hoje, quando o usuário não tem permissão para excluir, o botão/item simplesmente não aparece nos menus. Isso gera confusão pois o usuário não entende por que a opção sumiu. A melhoria é: em vez de esconder, mostrar o item desabilitado com tooltip explicando o motivo.

## Locais afetados

Há 3 componentes de cotação + 3 páginas com lógica similar:

### Cotações (prioridade)
1. **`CotacoesTable.tsx`** (linha ~594) — item "Excluir" no dropdown, escondido por `permissions.canDelete`
2. **`CotacaoCard.tsx`** (linha ~588) — item "Excluir" no dropdown, escondido por `permissions?.canDelete !== false`
3. **`CotacaoAcoes.tsx`** (linha ~241) — botão "Excluir Cotação" na página de detalhe, escondido por `canDelete`

### Outros módulos (mesmo padrão)
4. **`Contratos.tsx`** — "Excluir" escondido por `canDeleteContratos`
5. **`AtivacoesList.tsx`** — "Excluir" escondido por `canDeleteAtivacoes`
6. **`Associados.tsx`** — "Excluir" escondido por `canDeleteAssociados`

## Alterações

### Em cada local acima:

Trocar o padrão:
```tsx
{canDelete && (
  <DropdownMenuItem onClick={...}>Excluir</DropdownMenuItem>
)}
```

Por:
```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <span> {/* span wrapper necessário para tooltip em item disabled */}
      <DropdownMenuItem 
        disabled={!canDelete}
        onClick={canDelete ? handler : undefined}
      >
        Excluir
      </DropdownMenuItem>
    </span>
  </TooltipTrigger>
  {!canDelete && (
    <TooltipContent>
      Apenas o vendedor responsável ou diretores podem excluir
    </TooltipContent>
  )}
</Tooltip>
```

A mensagem do tooltip varia por contexto:
- **Cotações**: "Apenas o vendedor responsável ou diretores podem excluir" / "Cotações com contrato assinado/ativo não podem ser excluídas"
- **Contratos**: "Apenas diretores podem excluir contratos"
- **Associados**: "Apenas diretores podem excluir associados"
- **Ativações**: "Apenas diretores podem excluir ativações"

### `CotacaoAcoes.tsx` — Caso especial (botão, não dropdown)

Aqui o "Excluir" é um `Button` fora de dropdown. Mostrar sempre, desabilitado com tooltip quando `!canDelete`.

### Adicionar `deleteReason` ao tipo de permissões

Expandir `CotacoesTablePermissions` e `CotacaoCardPermissions` com campo opcional `deleteReason?: string` para transportar o motivo contextual (ex: "contrato ativo" vs "não é o vendedor").

### Atualizar `getPermissions` em `Cotacoes.tsx`

Adicionar lógica para definir `deleteReason`:
- Se tem contrato assinado/ativo → "Cotação com contrato ativo não pode ser excluída"
- Se não é owner nem diretor → "Apenas o vendedor responsável ou diretores podem excluir"

### Imports necessários

Adicionar `TooltipProvider, Tooltip, TooltipTrigger, TooltipContent` nos 6 arquivos afetados (já existem no projeto via `@/components/ui/tooltip`).

6 arquivos editados, nenhum arquivo novo.

