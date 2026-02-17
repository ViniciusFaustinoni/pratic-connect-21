

# Exibir Distancia GPS no Accordion do Analista de Eventos

## Contexto

O componente `ComparacaoPosicoes` ja calcula e exibe a distancia entre o local informado do evento e a ultima posicao do rastreador GPS, com classificacao visual (verde/amarelo/vermelho). Porem, na tela do analista (`EventoAnaliseDetalhe.tsx`), essa informacao fica escondida dentro de um accordion que precisa ser expandido.

## Solucao

Calcular a distancia diretamente no `EventoAnaliseDetalhe.tsx` e exibi-la como um Badge no titulo do accordion "Posicao na Hora do Evento", para que o analista veja imediatamente a consistencia sem precisar expandir.

## Alteracoes

### Arquivo: `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx`

1. Adicionar uma funcao `calcularDistanciaKm` (Haversine) no componente (ou importar do `ComparacaoPosicoes` se exportada)

2. Calcular a distancia quando ambas as coordenadas (informada/geocodificada e rastreador) estiverem disponiveis

3. No `AccordionTrigger` da secao "Posicao na Hora do Evento" (linha ~273-275), adicionar um Badge colorido ao lado do titulo mostrando a distancia e classificacao:
   - Menos de 500m: Badge verde "Proximo (Xm)"
   - Entre 500m e 2km: Badge amarelo "Divergencia (X.Xkm)"
   - Mais de 2km: Badge vermelho "Divergencia (X.Xkm)"

**Exemplo visual do resultado:**

```
[Accordion] Posicao na Hora do Evento    [Badge: 350m - verde]
[Accordion] Posicao na Hora do Evento    [Badge: 1.2km - amarelo]
[Accordion] Posicao na Hora do Evento    [Badge: 5.3km - vermelho]
```

### Detalhes tecnicos

```typescript
// Funcao Haversine (mesma ja usada em ComparacaoPosicoes)
function calcularDistanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// No componente, calcular distancia
const distanciaGps = useMemo(() => {
  if (sinistro?.latitude_informada && sinistro?.rastreador_lat) {
    return calcularDistanciaKm(
      sinistro.latitude_informada, sinistro.longitude_informada,
      sinistro.rastreador_lat, sinistro.rastreador_lng
    );
  }
  return null;
}, [sinistro]);

// No AccordionTrigger
<AccordionTrigger className="text-sm font-semibold">
  <span className="flex items-center gap-2">
    <Navigation className="h-4 w-4" /> Posicao na Hora do Evento
    {distanciaGps != null && (
      <Badge variant="outline" className={
        distanciaGps < 0.5 ? 'bg-green-100 text-green-800 border-green-300'
        : distanciaGps < 2 ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
        : 'bg-red-100 text-red-800 border-red-300'
      }>
        {distanciaGps < 1 ? `${Math.round(distanciaGps*1000)}m` : `${distanciaGps.toFixed(1)}km`}
      </Badge>
    )}
  </span>
</AccordionTrigger>
```

Isso permite que o analista veja de imediato se ha divergencia significativa entre o local informado e a posicao real do rastreador, sem precisar abrir o accordion.
