
# Revisao Completa - Fluxo de Busca de Posicao em Tempo Real Softruck

## Resumo Executivo

Apos analise detalhada do sistema de busca de posicao em tempo real dos rastreadores Softruck, identifiquei a seguinte situacao:

| Item | Status | Detalhes |
|------|--------|----------|
| Endpoint GET `/vehicles/{id}/tracking/{device_id}` | IMPLEMENTADO CORRETAMENTE | Presente em 3 edge functions |
| Header Authorization Bearer | IMPLEMENTADO | Com retry em erro 401 |
| Chamada na abertura do App | OK | Via hook `useVeiculoPosicao` |
| Chamada no mapa interno | OK | Via hook `useRastreadorTempoReal` |
| Polling automatico a cada X segundos | OK | 30 segundos via `refetchInterval` |
| Botao "Atualizar Posicao" | OK | Via mutation `atualizarManual` |
| Parse de latitude/longitude | OK | Extraido de `data.data.attributes` |
| Exibicao no mapa | OK | Leaflet com marcadores customizados |
| **PROBLEMA CRITICO** | **PUBLIC KEY INVALIDA** | `401 - Public key does not exist` |
| **PROBLEMA** | **IDS NAO CONFIGURADOS** | `plataforma_veiculo_id` e `plataforma_device_id` = NULL |

---

## Problemas Criticos Identificados

### 1. Public Key Softruck Invalida

Os logs do banco mostram erros consecutivos de autenticacao:

```
Falha auth Softruck: 401 - {"error":{"message":"Public key does not exist"}}
```

**Causa:** A secret `SOFTRUCK_PUBLIC_KEY` configurada no Supabase nao e reconhecida pela API Softruck.

**Impacto:** NENHUMA chamada ao endpoint de posicao consegue ser realizada porque a autenticacao falha antes.

---

### 2. Rastreadores Sem IDs de Plataforma

Consultando o banco de dados, TODOS os rastreadores Softruck instalados tem:

| Campo | Valor |
|-------|-------|
| `plataforma_veiculo_id` | NULL |
| `plataforma_device_id` | NULL |

**Impacto:** Mesmo que a autenticacao funcionasse, o endpoint seria chamado incorretamente:

```
GET /v2/vehicles/NULL/tracking/NULL?format=JSON
```

Os rastreadores possuem apenas `id_plataforma` populado (ex: "54321"), mas as edge functions esperam `plataforma_veiculo_id` e `plataforma_device_id`.

---

## Analise Detalhada dos Pontos de Chamada

### 1. Quando o associado abre a tela de rastreamento no App

**Arquivo:** `src/pages/app/AppRastreamento.tsx`
**Hook utilizado:** `useVeiculoPosicao` (de `useMyData.ts`)
**Edge Function:** `posicao-veiculo`

```typescript
// AppRastreamento.tsx (linha 133-139)
const { 
  posicao, 
  tempoReal, 
  offline, 
  refetch: refetchPosicao,
  atualizarManual 
} = useVeiculoPosicao(vehicle?.id);
```

**Fluxo:**
1. Usuario abre `/app/rastreamento`
2. Hook `useVeiculoPosicao` e ativado
3. Chama `posicao-veiculo` com `{ veiculo_id }`
4. Edge function busca rastreador do veiculo
5. Verifica `plataforma_veiculo_id` e `plataforma_device_id` -> **FALHA: campos NULL**
6. Lanca erro: "Rastreador nao configurado com IDs da plataforma"

**Status:** NAO FUNCIONA devido a falta de IDs

---

### 2. Quando o analista visualiza o mapa de monitoramento interno

**Arquivo:** `src/components/rastreadores/MapaRastreador.tsx`
**Hook utilizado:** `useRastreadorTempoReal` (de `useRastreadorPosicao.ts`)
**Edge Function:** `rastreador-posicao`

```typescript
// MapaRastreador.tsx (linha 78-86)
const {
  posicao,
  veiculo,
  tempoReal,
  mensagem,
  isLoading,
  isRefetching,
  atualizarManual
} = useRastreadorTempoReal(rastreadorId);
```

**Fluxo:**
1. Analista abre detalhe do rastreador
2. Hook `useRastreadorTempoReal` e ativado
3. Chama `rastreador-posicao` com `{ rastreador_id }`
4. Edge function verifica `plataforma_veiculo_id` e `plataforma_device_id` -> **FALHA: campos NULL**
5. Lanca erro: "Rastreador nao configurado com IDs da plataforma"

**Status:** NAO FUNCIONA devido a falta de IDs

---

### 3. Atualizacao automatica a cada X segundos (polling)

**Implementado corretamente em ambos os hooks:**

```typescript
// useVeiculoPosicao (useMyData.ts linha 269)
refetchInterval: 30000,  // 30 segundos

// useRastreadorTempoReal (useRastreadorPosicao.ts linha 103)
refetchInterval: autoRefresh ? 30000 : false,  // 30 segundos se autoRefresh = true
staleTime: 15000,  // Considera dados "frescos" por 15 segundos
```

**Status:** IMPLEMENTADO, mas nao funciona devido aos problemas anteriores.

---

### 4. Quando o associado clica em "Atualizar posicao"

**Arquivo:** `src/pages/app/AppRastreamento.tsx` (linha 468-475)

```tsx
<Button 
  className="w-full gap-2" 
  onClick={handleRefresh}
  disabled={isRefreshing}
>
  <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
  Atualizar Posição
</Button>
```

**Funcao `handleRefresh`:**

```typescript
const handleRefresh = async () => {
  setIsRefreshing(true);
  await Promise.all([refetch(), refetchPosicao()]);
  // ...
};
```

**Status:** IMPLEMENTADO, mas nao funciona devido aos problemas anteriores.

---

## Verificacao do Endpoint

### Endpoint Correto

| Requisito | Implementacao | Status |
|-----------|---------------|--------|
| Endpoint | `GET /v2/vehicles/{vehicleId}/tracking/{deviceId}` | OK |
| Query param | `?format=JSON` | OK |
| Alternativa | `?includes[geocoder][]=address&includes[geocoder][]=display_name&format=JSON` | OK (em softruck-api) |

### Locais de implementacao

**1. rastreador-posicao/index.ts (linha 72):**
```typescript
const url = `${baseUrl}/vehicles/${vehicleId}/tracking/${deviceId}?format=JSON`;
```

**2. posicao-veiculo/index.ts (linha 128):**
```typescript
const url = `${baseUrl}/vehicles/${vehicleId}/tracking/${deviceId}?format=JSON`;
```

**3. softruck-api/index.ts (linha 930):**
```typescript
const endpoint = `/v2/vehicles/${veiculoId}/tracking/${deviceId}?includes[geocoder][]=address&includes[geocoder][]=display_name&format=JSON`;
```

---

## Verificacao de Headers

### Authorization Bearer

| Arquivo | Linha | Implementacao |
|---------|-------|---------------|
| `rastreador-posicao/index.ts` | 79 | `'Authorization': Bearer ${token}` |
| `posicao-veiculo/index.ts` | 135 | `'Authorization': Bearer ${token}` |
| `sync-rastreadores/index.ts` | 196 | `'Authorization': Bearer ${token}` |

### Header public-key

| Arquivo | Linha | Implementacao |
|---------|-------|---------------|
| `rastreador-posicao/index.ts` | 80 | `'public-key': publicKey` |
| `posicao-veiculo/index.ts` | 136 | `'public-key': publicKey` |

**Status:** Ambos headers implementados corretamente.

---

## Parse de Resposta Softruck

### Formato esperado da API

```json
{
  "data": {
    "attributes": {
      "latitude": -23.5505,
      "longitude": -46.6333,
      "speed": 45,
      "course": 180,
      "ignition": true,
      "timestamp": "2026-01-29T12:00:00Z",
      "address": "Av. Paulista, 1000",
      "altitude": 750,
      "satellites": 8,
      "odometer": 15234,
      "battery": 95
    }
  }
}
```

### Implementacao do parse

```typescript
// rastreador-posicao/index.ts (linhas 104-126)
const data = await response.json();

if (!data.data?.attributes) {
  throw new Error('Resposta Softruck inválida');
}

const attrs = data.data.attributes;

return {
  latitude: attrs.latitude,
  longitude: attrs.longitude,
  velocidade: attrs.speed || 0,
  direcao: attrs.course,
  ignicao: attrs.ignition || false,
  data_posicao: attrs.timestamp || new Date().toISOString(),
  endereco: attrs.address,
  dados_extras: {
    altitude: attrs.altitude,
    satellites: attrs.satellites,
    odometer: attrs.odometer,
    battery: attrs.battery,
  }
};
```

**Status:** Parse implementado corretamente.

---

## Exibicao no Mapa

### Mapa do App do Associado

**Arquivo:** `src/pages/app/AppRastreamento.tsx`

```typescript
// Extrai latitude/longitude (linhas 142-147)
const latitude = posicao?.latitude ?? tracker?.ultima_posicao_lat ?? -18.9186;
const longitude = posicao?.longitude ?? tracker?.ultima_posicao_lng ?? -48.2772;

// Exibe no mapa Leaflet (linhas 314-330)
<MapContainer center={[latitude, longitude]} zoom={15}>
  <TileLayer ... />
  <Marker 
    position={[latitude, longitude]} 
    icon={getMarkerIcon(ignicao, emMovimento)}
  />
  <FlyToPosition position={[latitude, longitude]} zoom={15} />
</MapContainer>
```

### Mapa do Painel Interno

**Arquivo:** `src/components/rastreadores/MapaRastreador.tsx`

```typescript
// Extrai posicao (linhas 94-97)
const hasPosition = posicao?.latitude && posicao?.longitude;
const position: [number, number] = hasPosition
  ? [posicao.latitude, posicao.longitude]
  : [-15.7801, -47.9292]; // Brazil center

// Exibe no mapa (linhas 152-180)
<MapContainer center={position} zoom={15}>
  <TileLayer ... />
  <Marker position={position} icon={getMarkerIcon(posicao.ignicao)}>
    <Popup>
      <p>Velocidade: {posicao.velocidade} km/h</p>
      <p>Ignição: {posicao.ignicao ? 'Ligada' : 'Desligada'}</p>
      {posicao.endereco && <p>{posicao.endereco}</p>}
    </Popup>
  </Marker>
</MapContainer>
```

**Status:** Exibicao no mapa implementada corretamente.

---

## Teste com 3 Veiculos Diferentes

### Resultado da consulta ao banco

```sql
SELECT id, codigo, plataforma_veiculo_id, plataforma_device_id 
FROM rastreadores WHERE plataforma = 'softruck' LIMIT 5;
```

| codigo | plataforma_veiculo_id | plataforma_device_id |
|--------|-----------------------|---------------------|
| 123456 | NULL | NULL |
| 12345678 | NULL | NULL |
| 132458 | NULL | NULL |
| 123654 | NULL | NULL |
| 231546 | NULL | NULL |

**CONCLUSAO:** NAO E POSSIVEL TESTAR porque nenhum rastreador tem os IDs configurados.

---

## Diagrama do Fluxo Atual vs Esperado

```text
FLUXO ATUAL (BLOQUEADO)
=======================

App/Painel → useVeiculoPosicao/useRastreadorTempoReal
    |
    v
Edge Function (posicao-veiculo ou rastreador-posicao)
    |
    v
Busca rastreador no banco
    |
    v
Verifica plataforma_veiculo_id e plataforma_device_id
    |
    v
❌ ERRO: "Rastreador não configurado com IDs da plataforma"


FLUXO ESPERADO (SE CORRIGIDO)
=============================

App/Painel → useVeiculoPosicao/useRastreadorTempoReal
    |
    v
Edge Function (posicao-veiculo ou rastreador-posicao)
    |
    v
rastreador-auth → Obtem token Softruck
    |
    v
❌ ERRO: "Public key does not exist"  (Bloqueio atual)
    |
    v (se corrigido)
GET /vehicles/{id}/tracking/{device_id}?format=JSON
    Headers: Authorization: Bearer {token}
             public-key: {publicKey}
    |
    v
Parse resposta GeoJSON
    |
    v
Atualiza banco (rastreadores + rastreador_posicoes)
    |
    v
Retorna posicao para frontend
    |
    v
Exibe no mapa Leaflet
```

---

## Plano de Correcao

### Fase 1: Corrigir Public Key (BLOQUEADOR PRINCIPAL)

**Acao necessaria pelo usuario:**
1. Acessar painel Softruck
2. Obter a Public Key correta
3. Atualizar secret `SOFTRUCK_PUBLIC_KEY` no Supabase

### Fase 2: Corrigir Mapeamento de IDs

**Problema:** Os rastreadores tem `id_plataforma` populado, mas as edge functions esperam `plataforma_veiculo_id` e `plataforma_device_id`.

**Opcao A - Usar campo existente:**

Modificar edge functions para usar `id_plataforma` como fallback:

```typescript
// Em rastreador-posicao/index.ts e posicao-veiculo/index.ts

const vehicleId = rastreador.plataforma_veiculo_id || rastreador.id_plataforma;
const deviceId = rastreador.plataforma_device_id || rastreador.id_plataforma;

if (!vehicleId || !deviceId) {
  throw new Error('Rastreador não configurado com IDs da plataforma');
}
```

**Opcao B - Popular campos corretos:**

Criar script de migracao ou funcao que busque os IDs corretos na API Softruck e popule os campos.

### Fase 3: Verificar Formato de Resposta

Apos correcoes, validar que a API Softruck retorna no formato esperado:

```json
{
  "data": {
    "attributes": {
      "latitude": ...,
      "longitude": ...,
      ...
    }
  }
}
```

Caso retorne em formato diferente (ex: GeoJSON), ajustar o parse.

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/rastreador-posicao/index.ts` | Adicionar fallback para `id_plataforma` |
| `supabase/functions/posicao-veiculo/index.ts` | Adicionar fallback para `id_plataforma` |
| `supabase/functions/sync-rastreadores/index.ts` | Ja usa fallback, manter |

---

## Checklist de Verificacao Final

Apos correcoes, confirmar:

- [ ] Secret `SOFTRUCK_PUBLIC_KEY` atualizada com valor correto
- [ ] Autenticacao retorna token valido (sem erro 401)
- [ ] Campos `plataforma_veiculo_id` ou `id_plataforma` populados
- [ ] Endpoint `GET /vehicles/{id}/tracking/{device_id}` retorna dados
- [ ] Parse de resposta extrai latitude/longitude corretamente
- [ ] Mapa exibe posicao com marcador
- [ ] Polling a cada 30s atualiza posicao
- [ ] Botao "Atualizar Posicao" funciona
- [ ] Teste com 3+ veiculos mostra posicoes distintas

---

## Resumo dos Problemas

| # | Problema | Severidade | Solucao |
|---|----------|------------|---------|
| 1 | `SOFTRUCK_PUBLIC_KEY` invalida | CRITICO | Usuario deve atualizar secret |
| 2 | `plataforma_veiculo_id` NULL | ALTO | Adicionar fallback para `id_plataforma` |
| 3 | `plataforma_device_id` NULL | ALTO | Adicionar fallback para `id_plataforma` |

Sem a correcao do item 1 (Public Key), o sistema continuara completamente bloqueado.
