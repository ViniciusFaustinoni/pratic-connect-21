

# Trajeto do Veiculo Seguindo Ruas

## Problema

O componente `TrajetoLocalCard` desenha uma Polyline simples ligando os pontos GPS em linha reta. O resultado e um tracado que corta por cima de morros e predios ao inves de seguir as ruas reais.

## Solucao

Usar o servico OSRM ja existente no projeto (`routingService.ts`) para buscar rotas reais entre os pontos GPS consecutivos. O OSRM suporta multiplos waypoints em uma unica chamada, entao podemos enviar todos os pontos de uma vez e receber o trajeto completo pelas ruas.

## Alteracoes

### 1. Arquivo: `src/services/routingService.ts`

Adicionar uma nova funcao `getRouteOSRMMultiWaypoint` que aceita um array de coordenadas (todos os pontos GPS) e retorna a rota completa passando por todos eles. O OSRM suporta ate ~100 waypoints por chamada.

- Recebe array de `[lat, lng][]`
- Converte para formato OSRM `lng,lat` separados por `;`
- Faz uma unica chamada a API
- Retorna coordenadas da rota real, distancia e tempo

### 2. Arquivo: `src/components/sinistros/TrajetoLocalCard.tsx`

- Adicionar uma query (`useQuery`) que chama `getRouteOSRMMultiWaypoint` com os pontos GPS apos carrega-los
- Enquanto a rota real carrega, manter a polyline original (pontos GPS diretos) com estilo tracejado
- Quando a rota real chegar, substituir pela polyline com coordenadas reais (estilo solido)
- Adicionar `FitBounds` para ajustar zoom automaticamente (similar ao fix anterior)

### Detalhes tecnicos

**Nova funcao em `routingService.ts`:**

```typescript
export async function getRouteOSRMMultiWaypoint(
  pontos: [number, number][]
): Promise<RotaResult> {
  // Limitar a 25 waypoints para nao sobrecarregar a API publica
  // Selecionar pontos uniformemente distribuidos se houver mais de 25
  const pontosReduzidos = pontos.length > 25
    ? selecionarPontosUniformes(pontos, 25)
    : pontos;

  // Converter para formato OSRM: lng,lat;lng,lat;...
  const coords = pontosReduzidos
    .map(([lat, lng]) => `${lng},${lat}`)
    .join(';');

  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?geometries=geojson&overview=full`;

  // Fetch, parse e converter coordenadas de [lng,lat] para [lat,lng]
  // Com fallback para pontos originais em caso de erro
}
```

**Alteracao no `TrajetoLocalCard.tsx`:**

```typescript
// Apos carregar posicoes, buscar rota real
const rotaRealQuery = useQuery({
  queryKey: ['trajeto-local-rota-real', polylinePoints],
  queryFn: () => getRouteOSRMMultiWaypoint(polylinePoints),
  enabled: polylinePoints.length >= 2,
  staleTime: 60000, // cache de 1 minuto
});

// Usar rota real se disponivel, senao pontos GPS originais
const trajetoFinal = rotaRealQuery.data?.coordenadas || polylinePoints;
const isRotaReal = !!rotaRealQuery.data?.coordenadas;
```

A Polyline usara estilo tracejado enquanto carrega e solido quando a rota real estiver pronta. O mapa tambem tera `FitBounds` para garantir que todo o trajeto fique visivel.

