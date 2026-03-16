

## Plano: Remover badge "Restrições" e corrigir nome truncado

### Alterações em `src/components/cotacoes/CotacaoFormDialog.tsx`

**L1799-1806**: Remover o badge "Restrições" e o container flex extra que causa truncamento do nome. Simplificar para exibir apenas o `<h4>` sem `truncate`:

```tsx
<div className="flex items-center justify-between mb-2 gap-1">
  <h4 className="font-semibold text-sm">{plano.nome}</h4>
  {isSelecionado ? (
    <CheckCircle2 className="h-4 w-4 text-primary" />
  ) : plano.destaque ? (
    <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600">
      Recomendado
    </Badge>
  ) : null}
</div>
```

Isso remove o badge amber "Restrições" e permite que nomes como "SELECT BASIC", "SELECT PREMIUM", "SELECT EXCLUSIVE" apareçam completos sem corte.

### Arquivo afetado
- `src/components/cotacoes/CotacaoFormDialog.tsx`

