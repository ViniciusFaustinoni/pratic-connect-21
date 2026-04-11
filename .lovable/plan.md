

## Plano: Painel lateral recolhível na aba Atribuições

### Alteração

**`src/components/mapa/MapaVistoriasContent.tsx`** (apenas desktop, linhas 933-981)

- Adicionar estado `painelAberto` (default `true`)
- Quando recolhido, esconder o `Card` da lista de serviços (w-72) e mostrar um botão flutuante no canto esquerdo do mapa para reabrir
- Quando aberto, mostrar um botão de fechar (chevron) no header do Card
- Transição suave com `transition-all duration-300`

### Layout

```text
Aberto:                          Recolhido:
┌──────────┬──────────────┐      ┌──────────────────────┐
│ Serviços │              │      │[▶]                   │
│  w-72    │    Mapa      │      │         Mapa         │
│          │              │      │                      │
└──────────┴──────────────┘      └──────────────────────┘
```

### Detalhes
- Botão `ChevronLeft`/`ChevronRight` no header do Card para fechar/abrir
- Quando fechado: botão flutuante `z-[400]` com ícone `List` + contagem no canto superior esquerdo do mapa
- Mobile: sem alteração (já usa Drawer)

### Arquivo
- **Editar**: `src/components/mapa/MapaVistoriasContent.tsx`

