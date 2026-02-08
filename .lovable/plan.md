
# Adicionar Modal de Mapa na Página de Rastreadores

## Objetivo
Permitir que ao clicar em "Ver no Mapa" no card ou tabela de rastreadores, o mapa seja exibido em um modal na mesma página (similar ao que já funciona em "Detalhes do Associado").

## Problema Atual

Hoje em `RastreadorCard.tsx`, ao clicar no botão "Ver no Mapa", o sistema abre o Google Maps em uma nova aba. O usuário solicitou que isso funcione através de um modal dentro da página, como já existe em `AssociadoDetalhe.tsx`.

## Solução Proposta

### 1. Modificar `RastreadorCard.tsx`

Alterar o comportamento do botão "Ver no Mapa":
- Remover abertura do Google Maps (`window.open`)
- Adicionar callback `onViewMap` ao componente
- Disparar esse callback quando o botão é clicado

**Mudanças**:
- Adicionar prop `onViewMap?: () => void` à interface `RastreadorCardProps`
- Substituir o `onClick` do botão de mapa para chamar `onViewMap()` em vez de abrir Google Maps

### 2. Modificar `RastreadorGridView.tsx`

Receber e passar o callback de mapa:
- Adicionar prop `onViewMap?: (rastreadorId: string) => void`
- Passar esse callback para cada `RastreadorCard`

### 3. Modificar `RastreadorTableView.tsx`

Fazer o mesmo para a visualização de tabela:
- Adicionar prop `onViewMap?: (rastreadorId: string) => void`
- Alterar botão de ação de mapa para disparar o callback

### 4. Adicionar Gerenciamento de Estado em `Rastreadores.tsx`

Na página principal, adicionar:
- Estado `mapaModalOpen` (boolean) para controlar visibilidade do modal
- Estado `rastreadorMapaId` (string | null) para armazenar o rastreador selecionado
- Handler `handleViewMap` que recebe o rastreadorId e abre o modal

### 5. Renderizar Modal

Adicionar o modal de mapa (similar a `AssociadoDetalhe.tsx`):

```tsx
<Dialog open={mapaModalOpen} onOpenChange={setMapaModalOpen}>
  <DialogContent className="max-w-4xl max-h-[90vh]">
    <DialogHeader>
      <DialogTitle>Mapa do Rastreador</DialogTitle>
      <DialogDescription>
        Visualização em tempo real da posição do rastreador
      </DialogDescription>
    </DialogHeader>
    {rastreadorMapaId && (
      <MapaRastreador
        rastreadorId={rastreadorMapaId}
        altura="450px"
        mostrarControles={true}
      />
    )}
  </DialogContent>
</Dialog>
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/rastreadores/RastreadorCard.tsx` | Alterar botão "Ver no Mapa" para disparar callback em vez de abrir Google Maps; adicionar prop `onViewMap` |
| `src/components/rastreadores/RastreadorGridView.tsx` | Adicionar prop `onViewMap` e passar para cards |
| `src/components/rastreadores/RastreadorTableView.tsx` | Adicionar prop `onViewMap` e alterar lógica do botão de mapa |
| `src/pages/monitoramento/Rastreadores.tsx` | Adicionar estado do modal + handler + renderizar Dialog com MapaRastreador |

## Fluxo de Interação

1. Usuário clica em "Ver no Mapa" no card/tabela
2. Handler `handleViewMap` é acionado com o ID do rastreador
3. Estados `mapaModalOpen` e `rastreadorMapaId` são atualizados
4. Modal abre e exibe o `MapaRastreador` com a posição do rastreador
5. Ao fechar o modal, o estado é limpo

## Detalhes Técnicos

- **Componente de Mapa**: Reutilizar o `MapaRastreador.tsx` existente que já funciona corretamente
- **Dialog**: Usar o `Dialog` do Radix UI que já está em uso na página
- **Props**: Adicionar callbacks de forma backward-compatible (props opcionais)
- **Altura do Mapa**: Usar `altura="450px"` como em `AssociadoDetalhe.tsx`
- **Controles**: Manter `mostrarControles={true}` para permitir atualização manual

## Estados Esperados Após Implementação

✅ Modal abre ao clicar "Ver no Mapa" em um card/tabela  
✅ Mapa é exibido corretamente com a posição do rastreador  
✅ Botão de atualizar manual funciona dentro do modal  
✅ Fechar o modal restaura a visualização da listagem  
✅ Funciona em ambas as visualizações (cards e tabela)
