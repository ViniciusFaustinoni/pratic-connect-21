

# Usar rota real (OSRM) na comparacao de posicoes GPS

## Problema

O componente `ComparacaoPosicoes` calcula a distancia entre o local do evento e o rastreador GPS usando a formula de Haversine (linha reta). A linha tracejada no mapa tambem e uma linha reta. O usuario quer que tanto a distancia exibida quanto a rota no mapa sigam as ruas reais.

## Solucao

Substituir o calculo de linha reta pelo hook `useRotaReal` que ja existe no projeto e usa a API OSRM para tracar rotas pelas ruas.

## Alteracoes em `src/components/sinistros/ComparacaoPosicoes.tsx`

### 1. Importar o hook e componente de rota real

- Importar `useRotaReal` de `@/hooks/useRotaReal`
- Importar `RotaPolyline` de `@/components/mapa/RotaPolyline`

### 2. Usar `useRotaReal` para obter distancia real

Chamar o hook com as coordenadas do local informado e do rastreador. A distancia retornada (`distanciaKm`) sera pela rota das ruas, nao em linha reta.

### 3. Substituir Polyline por RotaPolyline no mapa

Trocar a `Polyline` de linha reta (linhas 191-199) pelo componente `RotaPolyline` que desenha a rota seguindo as ruas.

### 4. Usar distancia da rota na classificacao

Quando a rota estiver carregada, usar `distanciaKm` do OSRM. Enquanto carrega, manter o calculo Haversine como fallback com indicador de "calculando".

### 5. Manter fallback

A funcao `calcularDistanciaKm` (Haversine) sera mantida como fallback caso a API OSRM falhe.

## Arquivo alterado

- `src/components/sinistros/ComparacaoPosicoes.tsx`

