

# Plano: Remover status de comunicação e trocar drawer por modal

## Alterações

### 1. RastreadorMetrics.tsx — Esconder cards de comunicação
Manter apenas os cards **Total** e **Estoque**. Remover os cards **Online**, **Atenção** e **Offline** do array `metrics`. Atualizar o grid de `lg:grid-cols-5` para `lg:grid-cols-2`.

### 2. RastreadorTableView.tsx — Remover coluna "Comunicação"
- Remover o `<TableHead>Comunicação</TableHead>` (linha 123)
- Remover o `<TableCell>` de comunicação (linhas 276-309)
- Remover a lógica de `offline` e highlight vermelho na row (`bg-red-500/5`)
- Remover imports não usados: `Wifi`, `WifiOff`, `isRastreadorOnline`
- Tornar a row inteira clicável para abrir detalhes (`onClick={() => onOpenDetails(rastreador.id)}` no `<TableRow>`)

### 3. RastreadorCard.tsx — Remover indicadores de comunicação
Remover badges/ícones de Online/Offline e referências a `isRastreadorOnline` dos cards.

### 4. RastreadorDetailDrawer.tsx — Converter Sheet para Dialog (modal)
- Substituir `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle` por `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`
- Usar `max-w-2xl` para o modal, com `max-h-[90vh] overflow-y-auto`
- Todo o conteúdo interno permanece igual

### 5. Rastreadores.tsx — Atualizar uso do drawer para modal
- Trocar `<RastreadorDetailDrawer>` por novo componente modal (mesma interface)

## Arquivos alterados
- `src/components/rastreadores/RastreadorMetrics.tsx`
- `src/components/rastreadores/RastreadorTableView.tsx`
- `src/components/rastreadores/RastreadorCard.tsx`
- `src/components/rastreadores/RastreadorDetailDrawer.tsx`

