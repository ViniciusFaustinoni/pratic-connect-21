
# Ajustar Zoom do Mapa para Exibir Ambos os Pinos

## Problema

O mapa "Posicoes GPS - Evidencia" no componente `ComparacaoPosicoes` nao ajusta o zoom automaticamente para mostrar os dois marcadores (rastreador e local do evento). Ele usa `zoom={13}` fixo quando ha bounds, mas o `MapContainer` do react-leaflet nao re-aplica bounds dinamicamente apos a renderizacao inicial.

## Solucao

Adicionar um componente interno `FitBounds` que usa o hook `useMap()` para chamar `map.fitBounds()` apos o mapa ser montado, garantindo que ambos os pinos fiquem visiveis com padding adequado.

## Alteracoes

### Arquivo: `src/components/sinistros/ComparacaoPosicoes.tsx`

1. Importar `useMap` de `react-leaflet`

2. Criar componente `FitBounds` (similar ao `FlyToPosition` do `MapaRastreador.tsx`):

```typescript
function FitBounds({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  }, [map, bounds]);
  return null;
}
```

3. Dentro do `MapContainer` (linha ~158), adicionar o componente `FitBounds` quando `mapConfig.bounds` existir, e remover os props `bounds` e `boundsOptions` do `MapContainer` (que nao funcionam confiavelmente):

- Remover: `bounds={mapConfig.bounds || undefined}` e `boundsOptions={{ padding: [40, 40] }}`
- Adicionar dentro do MapContainer: `{mapConfig.bounds && <FitBounds bounds={mapConfig.bounds} />}`

4. Importar `useEffect` de react (ja importado `useMemo`, adicionar `useEffect`)
