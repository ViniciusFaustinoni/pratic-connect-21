

# Mostrar Mapa Automaticamente na Aba Rastreador

## Situação Atual

A aba "Rastreador" no modal de detalhes do veículo já tem o componente `MapaRastreador`, mas ele fica oculto atrás de um botão "Ver no Mapa" (toggle `showMapa`). O mapa deveria ser exibido automaticamente quando há rastreador.

## Alteração

### `src/components/cadastro/VeiculoDetalhesModal.tsx` (linhas ~306-316)

Remover o botão toggle e exibir o mapa diretamente quando há rastreador:

```tsx
// DE:
<Button variant="outline" onClick={() => setShowMapa(!showMapa)}>
  <MapPin /> {showMapa ? 'Ocultar Mapa' : 'Ver no Mapa'}
</Button>
{showMapa && (
  <div className="mt-4 rounded-lg overflow-hidden border">
    <MapaRastreador rastreadorId={rastreador.id} altura="400px" />
  </div>
)}

// PARA:
<div className="rounded-lg overflow-hidden border">
  <MapaRastreador rastreadorId={rastreador.id} altura="400px" />
</div>
```

Remover o state `showMapa` se não for usado em outro lugar.

## Impacto
- 1 arquivo alterado
- Mapa aparece imediatamente ao abrir a aba Rastreador

