

# Centralizar Modais de Detalhes (Associado e Veículo)

## Situação Atual

- **Veículo**: Já usa `Dialog` (centralizado) — OK
- **Associado**: Usa `Sheet` (painel lateral direito) — precisa mudar para `Dialog` centralizado

## Alteração

### `src/pages/cadastro/Associados.tsx`

Substituir o `Sheet`/`SheetContent` por `Dialog`/`DialogContent`:

```tsx
// DE:
<Sheet open={!!detalheAssociadoId} onOpenChange={...}>
  <SheetContent side="right" className="w-full sm:max-w-[900px] lg:max-w-[1100px] p-0 overflow-y-auto">

// PARA:
<Dialog open={!!detalheAssociadoId} onOpenChange={...}>
  <DialogContent className="max-w-5xl max-h-[92vh] p-0 overflow-y-auto">
```

- Atualizar imports: remover `Sheet`/`SheetContent`, adicionar `Dialog`/`DialogContent`
- Manter o conteúdo interno igual (`AssociadoDetalhe` com `isModal`)

## Impacto
- 1 arquivo alterado
- Modal do associado passa a abrir centralizado, igual ao do veículo

