
# Plano: Corrigir Edge Function rastreador-posicao para Formato Softruck v2

## Problema Identificado

O modal "Localização do Veículo" mostra "Sem posição disponível" porque a Edge Function `rastreador-posicao` não está extraindo corretamente as coordenadas da resposta da API Softruck v2.

### Causa Raiz

A API Softruck v2 retorna coordenadas no formato **GeoJSON** (`geometry.coordinates = [longitude, latitude]`), mas a Edge Function tenta ler `attrs.latitude` e `attrs.longitude`, que não existem nesse formato.

**Response Network atual:**
```json
{
  "success": true,
  "tempo_real": true,
  "posicao": {
    "velocidade": 0,
    "ignicao": false,
    "data_posicao": "2026-02-03T09:41:40.471Z",
    "dados_extras": {}
  }
}
```

O `latitude` e `longitude` estão **ausentes** porque a extração falhou!

### Comparação de Implementações

| Função | Método de Extração | Status |
|--------|-------------------|--------|
| `sync-rastreadores` | `geometry.coordinates[0]` (lng), `geometry.coordinates[1]` (lat) | Funciona |
| `rastreador-posicao` | `attrs.latitude`, `attrs.longitude` | Não funciona |

---

## Solução

Corrigir a função `getPosicaoSoftruckComRetry` em `rastreador-posicao` para usar o mesmo método de extração do `sync-rastreadores`.

### Arquivo: `supabase/functions/rastreador-posicao/index.ts`

**Trecho atual (linhas 114-136):**
```typescript
const data = await response.json();

if (!data.data?.attributes) {
  throw new Error('Resposta Softruck inválida');
}

const attrs = data.data.attributes;

return {
  latitude: attrs.latitude,       // ❌ NÃO EXISTE no formato v2
  longitude: attrs.longitude,     // ❌ NÃO EXISTE no formato v2
  velocidade: attrs.speed || 0,
  ...
};
```

**Correção (formato GeoJSON v2):**
```typescript
const data = await response.json();

// Formato API v2 Softruck (GeoJSON):
// - data.data.type = "Feature"
// - data.data.geometry.coordinates = [longitude, latitude]
// - data.data.attributes contém: ign, spd, act, dir, bl, etc.

const gpsData = data.data;
if (!gpsData) {
  throw new Error('Resposta Softruck inválida');
}

// Extrair coordenadas do GeoJSON
let latitude: number | null = null;
let longitude: number | null = null;

if (gpsData.geometry?.coordinates) {
  // GeoJSON: coordinates = [longitude, latitude]
  longitude = parseFloat(gpsData.geometry.coordinates[0]);
  latitude = parseFloat(gpsData.geometry.coordinates[1]);
} else if (gpsData.attributes?.latitude && gpsData.attributes?.longitude) {
  // Fallback: formato alternativo com lat/lng direto
  latitude = parseFloat(gpsData.attributes.latitude);
  longitude = parseFloat(gpsData.attributes.longitude);
}

if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
  console.error('[Softruck] Resposta sem coordenadas:', JSON.stringify(gpsData).slice(0, 300));
  throw new Error('Coordenadas não encontradas na resposta Softruck');
}

const attrs = gpsData.attributes || {};

// Converter timestamp Unix para ISO se necessário
const actTimestamp = attrs.act;
const dataPosicao = actTimestamp 
  ? new Date(actTimestamp * 1000).toISOString() 
  : (attrs.timestamp || new Date().toISOString());

return {
  latitude,
  longitude,
  velocidade: parseInt(attrs.spd || attrs.speed || 0),
  direcao: attrs.dir || attrs.course,
  ignicao: Boolean(attrs.ign || attrs.ignition),
  data_posicao: dataPosicao,
  endereco: attrs.address,
  dados_extras: {
    altitude: attrs.altitude,
    satellites: attrs.satellites,
    odometer: attrs.odometer,
    battery: attrs.bl || attrs.battery,
  }
};
```

---

## Diferenças de Formato

### Resposta Softruck v2 (GeoJSON)
```json
{
  "data": {
    "type": "Feature",
    "geometry": {
      "type": "Point",
      "coordinates": [-43.29465800, -22.79677300]
    },
    "attributes": {
      "ign": false,
      "spd": 0,
      "dir": 180,
      "act": 1707000000,
      "bl": 12.5
    }
  }
}
```

### Resultado Esperado após Correção
```json
{
  "success": true,
  "tempo_real": true,
  "posicao": {
    "latitude": -22.79677300,
    "longitude": -43.29465800,
    "velocidade": 0,
    "direcao": 180,
    "ignicao": false,
    "data_posicao": "2026-02-03T09:41:40.471Z",
    "dados_extras": {
      "battery": 12.5
    }
  },
  "veiculo": {...}
}
```

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/rastreador-posicao/index.ts` | **MODIFICAR** | Corrigir extração de coordenadas para formato GeoJSON v2 |

---

## Impacto

Após a correção:
- O componente `MapaRastreador` receberá `posicao.latitude` e `posicao.longitude` corretamente
- O mapa exibirá a posição real do veículo
- O botão "Atualizar" buscará a posição em tempo real da plataforma Softruck
- Os dados de velocidade, ignição e direção serão exibidos corretamente

---

## Teste

Após deploy, o modal deve exibir:
- Mapa com o veículo **LTB4J74** na posição **-22.796773, -43.294658**
- Badge "🟢 Tempo Real"
- Painel inferior com velocidade, status de ignição e última atualização
