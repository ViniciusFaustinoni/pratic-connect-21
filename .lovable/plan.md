
# Revisao Completa - Fluxo de Consulta de Historico de Trajetos Softruck

## Resumo Executivo

Apos analise detalhada do sistema de consulta de historico de trajetos Softruck, identifiquei a seguinte situacao:

| Item | Status | Detalhes |
|------|--------|----------|
| Endpoint GET `/vehicles/{id}/trajectories/` | IMPLEMENTADO | Usado em `rastreador-historico` e `historico-posicoes` |
| Endpoint GET `/vehicles/{id}/trajectories/geom` | PARCIALMENTE IMPLEMENTADO | Existe em `softruck-api` mas nao e usado |
| Filtros de data (start_date, end_date) | IMPLEMENTADO | Presentes corretamente |
| Atributos SEGMENT, DETAILED, ALARM, STOP | NAO IMPLEMENTADOS | Nao solicitados na query |
| Renderizacao no mapa | IMPLEMENTADO | Leaflet com Polyline |
| Pontos de parada destacados | NAO IMPLEMENTADOS | Apenas inicio/fim marcados |
| Calculo tempo parado/movimento | IMPLEMENTADO | Em `historico-posicoes` |
| Integracao com auditoria de sinistros | NAO IMPLEMENTADA | Nao ha consulta de trajeto em sinistros |
| Relatorio mensal quilometragem | NAO IMPLEMENTADO | Nao existe relatorio dedicado |

---

## Analise Detalhada dos Pontos de Chamada

### 1. Quando o associado solicita "Ver trajeto" de data especifica

**Arquivos:** `src/pages/app/AppRastreamentoHistorico.tsx`, `src/hooks/useMyData.ts`
**Edge Function:** `historico-posicoes`

```typescript
// useVeiculoHistorico (useMyData.ts linha 349-386)
const { data, error } = await supabase.functions.invoke('historico-posicoes', {
  body: {
    veiculo_id: veiculoId,
    data_inicio: dataInicio.toISOString(),
    data_fim: dataFim.toISOString(),
    intervalo_minutos: intervaloMinutos,
  }
});
```

**Interface do App:**
- Seletor de periodo (24h, 3 dias, 7 dias)
- DatePicker com range customizado
- Seletor de intervalo (5, 15, 30, 60 min)
- Playback com controles de reproducao

**Status:** FUNCIONAL (dependendo da autenticacao)

---

### 2. Quando o analista visualiza historico no painel interno

**Arquivo:** `src/components/rastreadores/MapaHistorico.tsx`
**Hook:** `useRastreadorHistoricoAPI` (de `useRastreadorHistoricoAPI.ts`)
**Edge Function:** `rastreador-historico`

```typescript
// useRastreadorHistoricoAPI (linha 35-48)
const { data, error } = await supabase.functions.invoke('rastreador-historico', {
  body: { 
    rastreador_id: rastreadorId,
    data_inicio: dataInicio?.toISOString(),
    data_fim: dataFim?.toISOString(),
  },
});
```

**Status:** FUNCIONAL (dependendo da autenticacao)

---

### 3. Quando ha auditoria de posicao em caso de sinistro

**Status:** NAO IMPLEMENTADO

Ao analisar `SinistroDetalhe.tsx`, nao existe integracao com o historico de trajetos do rastreador. A pagina de sinistro nao oferece:
- Botao "Ver trajeto do veiculo" na data do sinistro
- Mapa com posicoes do veiculo no momento do evento
- Consulta automatica ao historico para auditoria

---

### 4. Quando e gerado o relatorio mensal de quilometragem

**Status:** NAO IMPLEMENTADO

Analisando `relatoriosConfig.ts`, nao existe configuracao para relatorio de quilometragem. Os relatorios existentes sao:
- Operacional: instalacoes, tempo instalacao, estoque rastreadores, chamados
- NAO HA: quilometragem mensal por veiculo, distancia percorrida por associado

---

## Verificacao do Endpoint e Parametros

### Endpoint Atual

As edge functions usam:
```
GET /v2/vehicles/{id}/trajectories/?filters[start_date]=X&filters[end_date]=Y&limit=1000
```

### Endpoint Disponivel Mas Nao Utilizado

O `softruck-api/index.ts` possui suporte para `trajectories-geom`:
```typescript
case 'trajectories-geom': {
  let endpoint = `/v2/vehicles/${veiculoId}/trajectories/geom`;
  if (dataInicio && dataFim) {
    endpoint += `?filters[fromAcc]=${encodeURIComponent(dataInicio)}&filters[toAcc]=${encodeURIComponent(dataFim)}`;
  }
}
```

**Observacao:** O endpoint `/trajectories/geom` retorna geometria GeoJSON otimizada para renderizacao no mapa.

---

## GAP: Atributos SEGMENT, DETAILED, ALARM, STOP

### Problema

A API Softruck suporta atributos especiais para enriquecer os dados de trajeto:
- **SEGMENT**: Agrupa trajeto em segmentos de viagem
- **DETAILED**: Retorna todos os pontos sem simplificacao
- **ALARM**: Inclui eventos de alarme (velocidade, cerca, etc.)
- **STOP**: Inclui pontos de parada com duracao

### Situacao Atual

Nenhum desses atributos e solicitado nas chamadas atuais. As edge functions usam apenas os parametros basicos:
```typescript
url.searchParams.set('filters[start_date]', inicio);
url.searchParams.set('filters[end_date]', fim);
url.searchParams.set('limit', '500');  // ou 1000
```

### Correcao Necessaria

Adicionar parametros para solicitar atributos extras quando necessario:
```typescript
// Para trajeto detalhado
url.searchParams.set('attributes[]', 'DETAILED');
url.searchParams.set('attributes[]', 'STOP');
// OU
url.searchParams.set('includes[stops]', 'true');
```

---

## GAP: Pontos de Parada Nao Destacados

### Problema

Os mapas de historico (`MapaHistorico.tsx` e `AppRastreamentoHistorico.tsx`) apenas mostram:
- Marcador verde no inicio
- Marcador vermelho no fim
- Marcador azul na posicao atual do playback
- Polyline conectando todos os pontos

**NAO mostram:**
- Marcadores nos pontos de parada (velocidade = 0)
- Cor diferente para segmentos parados vs em movimento
- Pop-up com duracao da parada

### Dados Disponiveis

O sistema ja calcula tempo parado em `historico-posicoes`:
```typescript
if (anterior.velocidade > 0 || anterior.ignicao) {
  tempoMovimento += diffMin;
} else {
  tempoParado += diffMin;
}
```

Porem nao identifica os pontos especificos de parada para exibicao no mapa.

---

## Plano de Correcoes

### Fase 1: Adicionar Atributos STOP nas Consultas

**Arquivos a modificar:**
- `supabase/functions/rastreador-historico/index.ts`
- `supabase/functions/historico-posicoes/index.ts`

```typescript
// Adicionar parametro para incluir paradas
const url = new URL(`${baseUrl}/vehicles/${vehicleId}/trajectories/`);
url.searchParams.set('filters[start_date]', inicio);
url.searchParams.set('filters[end_date]', fim);
url.searchParams.set('includes[stops]', 'true');  // NOVO
url.searchParams.set('limit', '1000');
```

---

### Fase 2: Identificar e Retornar Pontos de Parada

**Modificar edge functions para extrair paradas:**

```typescript
interface PontoParada {
  latitude: number;
  longitude: number;
  inicio: string;
  fim: string;
  duracao_minutos: number;
  endereco?: string;
}

function identificarParadas(pontos: PontoPosicao[]): PontoParada[] {
  const paradas: PontoParada[] = [];
  let inicioParada: number | null = null;
  
  for (let i = 0; i < pontos.length; i++) {
    const ponto = pontos[i];
    const estaParado = ponto.velocidade === 0 && !ponto.ignicao;
    
    if (estaParado && inicioParada === null) {
      inicioParada = i;
    } else if (!estaParado && inicioParada !== null) {
      const pontoInicio = pontos[inicioParada];
      const duracao = (new Date(ponto.data_hora).getTime() - 
                       new Date(pontoInicio.data_hora).getTime()) / 60000;
      
      if (duracao >= 5) { // Paradas > 5 minutos
        paradas.push({
          latitude: pontoInicio.latitude,
          longitude: pontoInicio.longitude,
          inicio: pontoInicio.data_hora,
          fim: pontos[i - 1].data_hora,
          duracao_minutos: Math.round(duracao),
          endereco: pontoInicio.endereco,
        });
      }
      inicioParada = null;
    }
  }
  
  return paradas;
}
```

---

### Fase 3: Renderizar Pontos de Parada no Mapa

**Arquivos a modificar:**
- `src/components/rastreadores/MapaHistorico.tsx`
- `src/pages/app/AppRastreamentoHistorico.tsx`

```tsx
// Adicionar marcadores de parada
const stopIcon = L.divIcon({
  className: 'stop-marker',
  html: `<div style="width: 10px; height: 10px; background: #f59e0b; border-radius: 50%; border: 2px solid white;"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

// Renderizar paradas
{paradas.map((parada, idx) => (
  <Marker
    key={`stop-${idx}`}
    position={[parada.latitude, parada.longitude]}
    icon={stopIcon}
  >
    <Popup>
      <div className="text-sm">
        <strong>Parada</strong>
        <p>{parada.duracao_minutos} minutos</p>
        <p>{format(new Date(parada.inicio), 'HH:mm')} - {format(new Date(parada.fim), 'HH:mm')}</p>
        {parada.endereco && <p className="text-xs">{parada.endereco}</p>}
      </div>
    </Popup>
  </Marker>
))}
```

---

### Fase 4: Integracao com Auditoria de Sinistros

**Novo componente:** `src/components/sinistros/TrajetoSinistroCard.tsx`

Adicionar na pagina `SinistroDetalhe.tsx`:
- Card com mapa do trajeto nas 24h anteriores ao sinistro
- Automaticamente buscar historico pela data_ocorrencia
- Destacar localizacao do sinistro no mapa
- Botao "Ver trajeto completo" que abre em tela cheia

**Modificar:** `src/pages/eventos/SinistroDetalhe.tsx`
```tsx
// Importar componente de trajeto
import { TrajetoSinistroCard } from '@/components/sinistros/TrajetoSinistroCard';

// Renderizar na sidebar
{sinistro.veiculo_id && (
  <TrajetoSinistroCard
    veiculoId={sinistro.veiculo_id}
    dataOcorrencia={sinistro.data_ocorrencia}
    localOcorrencia={sinistro.local_ocorrencia}
  />
)}
```

---

### Fase 5: Relatorio Mensal de Quilometragem

**Novo arquivo:** `src/config/relatoriosQuilometragem.ts`

Adicionar configuracao no `relatoriosConfig.ts`:
```typescript
'quilometragem-mensal': {
  id: 'quilometragem-mensal',
  titulo: 'Quilometragem Mensal',
  tabela: 'custom', // Requer query customizada
  select: '', // Calculado via edge function
  cabecalhos: ['Veiculo', 'Placa', 'KM Inicial', 'KM Final', 'Total'],
  descricao: 'Distancia percorrida no periodo',
},
```

**Nova edge function:** `supabase/functions/relatorio-quilometragem/index.ts`

Consolidar dados de `rastreador_posicoes` para calcular quilometragem acumulada.

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/sinistros/TrajetoSinistroCard.tsx` | Card com mapa de trajeto no sinistro |
| `supabase/functions/relatorio-quilometragem/index.ts` | Edge function para relatorio mensal |

---

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/rastreador-historico/index.ts` | Adicionar includes[stops] e retornar paradas |
| `supabase/functions/historico-posicoes/index.ts` | Adicionar identificacao de paradas |
| `src/components/rastreadores/MapaHistorico.tsx` | Renderizar marcadores de parada |
| `src/pages/app/AppRastreamentoHistorico.tsx` | Renderizar marcadores de parada |
| `src/pages/eventos/SinistroDetalhe.tsx` | Adicionar card de trajeto para auditoria |
| `src/config/relatoriosConfig.ts` | Adicionar config de relatorio quilometragem |

---

## Checklist de Verificacao Final

Apos implementacao, confirmar:

- [ ] Filtros de data (start_date, end_date) aplicados corretamente
- [ ] Atributos STOP solicitados e parseados
- [ ] Pontos de parada (velocidade = 0 por > 5 min) identificados
- [ ] Marcadores amarelos de parada exibidos no mapa
- [ ] Pop-up com duracao da parada funcional
- [ ] Card de trajeto na pagina de sinistro funcionando
- [ ] Trajeto das 24h antes do sinistro carregando
- [ ] Relatorio de quilometragem disponivel na Central
- [ ] Teste com trajeto de 24h mostra pontos em sequencia
- [ ] Teste com 3 veiculos diferentes confirma posicoes distintas

---

## Teste Recomendado

### Teste de 24 horas com pontos em sequencia

1. Acessar App do Associado > Rastreamento > Historico
2. Selecionar periodo de 24h (botao preset)
3. Verificar que trajeto carrega com todos os pontos
4. Iniciar reproducao e confirmar sequencia cronologica
5. Verificar que paradas (marcadores amarelos) aparecem
6. Clicar em parada e confirmar pop-up com duracao

### Teste com 3 veiculos diferentes

Requer que:
1. `SOFTRUCK_PUBLIC_KEY` esteja correta (bloqueador atual)
2. Rastreadores tenham `id_plataforma` populado
3. Veiculos diferentes estejam em localizacoes distintas

---

## Resumo dos Gaps

| # | Gap | Severidade | Fase |
|---|-----|------------|------|
| 1 | Atributos STOP nao solicitados | MEDIA | Fase 1 |
| 2 | Pontos de parada nao identificados | MEDIA | Fase 2 |
| 3 | Marcadores de parada nao renderizados | MEDIA | Fase 3 |
| 4 | Auditoria de trajeto em sinistros inexistente | ALTA | Fase 4 |
| 5 | Relatorio de quilometragem inexistente | MEDIA | Fase 5 |
| 6 | `SOFTRUCK_PUBLIC_KEY` invalida | CRITICO | Configuracao |

A correcao do item 6 (Public Key) continua sendo pre-requisito para todas as funcionalidades que dependem da API Softruck.
