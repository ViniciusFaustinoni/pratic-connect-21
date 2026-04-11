

## Plano: Mostrar distância e tempo estimado na rota técnico → serviço (com atualização em tempo real)

### Contexto Atual
- O `RotaPolyline` já usa OSRM para desenhar a rota real entre técnico e serviço
- O popup da rota mostra apenas nome do técnico e placa, sem distância/tempo
- O `useRotaReal` já retorna `distanciaKm` e `tempoMinutos` do OSRM
- As posições dos técnicos já atualizam em tempo real via Supabase Realtime (`vistoriadores_localizacao`)
- Quando a posição muda, o `linhasDeRota` recalcula e o `useRotaReal` refaz a chamada OSRM automaticamente

### Alterações

**1. `src/components/mapa/RotaPolyline.tsx`** - Expor distância/tempo via callback + mostrar badge no mapa
- Adicionar prop `onRouteInfo?: (info: { distanciaKm: number; tempoMinutos: number }) => void` para comunicar dados ao pai
- Calcular tempo estimado usando regra 1km/min (em vez do OSRM duration)
- Renderizar um Tooltip permanente no ponto médio da rota com distância e tempo restante

**2. `src/components/mapa/MapaVistoriasContent.tsx`** - Exibir info de distância/tempo sobre cada rota
- Alterar o `popupContent` do `RotaPolyline` para incluir distância em km e tempo estimado (1km/min)
- Adicionar estado `rotasInfo` para armazenar distância/tempo por técnico
- Mostrar badge flutuante sobre cada rota com "X.X km • ~X min"

**3. `src/components/mapa/RotaInfoOverlay.tsx`** (novo) - Componente de overlay sobre a rota
- Marker invisível no ponto médio da polyline com Tooltip permanente mostrando distância e tempo
- Atualiza automaticamente quando OSRM retorna novos dados

### Comportamento
- Cada rota técnico→serviço mostra um badge no ponto médio: "3.2 km • ~3 min"
- O popup ao clicar na rota mostra: nome do técnico, placa destino, distância e tempo
- Quando o técnico se move (realtime), a rota redesenha e distância/tempo atualizam
- Regra de tempo: `distanciaKm` arredondado para cima = minutos (1 km/min)

### Arquivos
- **Editar**: `src/components/mapa/RotaPolyline.tsx`
- **Editar**: `src/components/mapa/MapaVistoriasContent.tsx`
- **Criar**: `src/components/mapa/RotaInfoOverlay.tsx`

