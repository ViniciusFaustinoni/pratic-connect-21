
# Plano: Buscar Localização Softruck Para Rastreadores Já Ativados

## Diagnóstico do Problema

O rastreador `862667083494305` está **ativado com sucesso** na Softruck (`softruck_integration_status = SUCCESS`), mas o sistema mostra "Veículo sem posição GPS" porque:

| Problema | Causa |
|----------|-------|
| `ultima_posicao_lat = NULL` | Posição nunca foi sincronizada após ativação |
| `ultima_comunicacao = NULL` | Sincronização não está buscando posição |

### Problema Principal: Endpoint Incorreto

A função `sync-rastreadores` está usando o **endpoint errado** para buscar posição:

```
INCORRETO: GET /v2/tracking/gps-data?device_id={deviceId}
CORRETO:   GET /v2/vehicles/{vehicle_id}/tracking/{device_id}
```

Além disso:
1. Falta o header `public-key` obrigatório
2. Falta o `plataforma_veiculo_id` na query (só usa `plataforma_device_id`)

## Correções Necessárias

### 1. Corrigir `sync-rastreadores` para Softruck

**Arquivo:** `supabase/functions/sync-rastreadores/index.ts`

**Alteração na função `syncSoftruck`:**

```typescript
// ANTES (linha 191-199)
const response = await fetch(
  `${config.baseUrl}/tracking/gps-data?device_id=${deviceId}`,
  {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  }
);

// DEPOIS - Usar endpoint correto da documentação
const vehicleId = rast.plataforma_veiculo_id || rast.id_plataforma;
const deviceId = rast.plataforma_device_id || rast.id_plataforma;

const response = await fetch(
  `${config.baseUrl}/vehicles/${vehicleId}/tracking/${deviceId}?format=JSON`,
  {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "public-key": config.publicKey || "",
      "Content-Type": "application/json",
    },
  }
);
```

**Alteração na interface `Rastreador`:**

```typescript
// ANTES (linha 46-52)
interface Rastreador {
  id: string;
  codigo: string;
  plataforma: string;
  id_plataforma: string;
  plataforma_device_id?: string;
}

// DEPOIS - Adicionar plataforma_veiculo_id
interface Rastreador {
  id: string;
  codigo: string;
  plataforma: string;
  id_plataforma: string;
  plataforma_device_id?: string;
  plataforma_veiculo_id?: string;
}
```

**Alteração no parsing da resposta:**

```typescript
// ANTES (linha 219-232)
const data = await response.json();
const gpsData = Array.isArray(data.data) ? data.data[0] : data.data;

// DEPOIS - Formato correto da API v2
const data = await response.json();
const gpsData = data.data?.attributes || data.data;

if (gpsData && gpsData.latitude && gpsData.longitude) {
  posicoes.push({
    rastreador_id: rast.id,
    latitude: parseFloat(gpsData.latitude),
    longitude: parseFloat(gpsData.longitude),
    velocidade: parseInt(gpsData.speed || 0),
    ignicao: Boolean(gpsData.ignition),
    data_posicao: gpsData.timestamp || new Date().toISOString(),
    odometro: gpsData.odometer || undefined,
    direcao: gpsData.course || gpsData.heading || undefined,
    bateria_nivel: gpsData.battery || undefined,
  });
  result.sucesso++;
}
```

**Alteração na query de rastreadores (na função serve):**

Precisa incluir `plataforma_veiculo_id` no SELECT dos rastreadores.

### 2. Testar Sincronização Manual

Após a correção, chamar a edge function `sync-rastreadores` para popular a posição:

```bash
POST /functions/v1/sync-rastreadores
{ "plataforma": "softruck" }
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/sync-rastreadores/index.ts` | Corrigir endpoint, headers e parsing |

## Detalhes Técnicos

### Comparação: Endpoint Atual vs Correto

| Aspecto | Atual (Errado) | Correto |
|---------|----------------|---------|
| URL | `/tracking/gps-data?device_id=X` | `/vehicles/{vehicle_id}/tracking/{device_id}` |
| Header `public-key` | Ausente | Obrigatório |
| Query Param | `?device_id=X` | `?format=JSON` |
| Response Path | `data[0]` ou `data` | `data.attributes` |

### Campos Necessários do Rastreador

| Campo | Usado Para |
|-------|-----------|
| `plataforma_veiculo_id` | `{vehicle_id}` na URL |
| `plataforma_device_id` | `{device_id}` na URL |

### Dados do Rastreador 862667083494305

| Campo | Valor |
|-------|-------|
| `plataforma_veiculo_id` | `Xqn2Qpq6NmZ9OjD` |
| `plataforma_device_id` | `RY2PZgqeVpLejAx` |

### URL Correta para Este Rastreador

```
GET https://api.softruck.com/v2/vehicles/Xqn2Qpq6NmZ9OjD/tracking/RY2PZgqeVpLejAx?format=JSON
Headers:
  Authorization: Bearer {token}
  public-key: {public_key}
```

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────┐
│  SINCRONIZAÇÃO DE POSIÇÕES SOFTRUCK (CORRIGIDO)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Busca rastreadores com status='instalado' e softruck        │
│     └─> SELECT id, plataforma_veiculo_id, plataforma_device_id  │
│                                                                 │
│  2. Para cada rastreador:                                       │
│     ├─> GET /v2/vehicles/{veiculo}/tracking/{device}            │
│     ├─> Headers: Authorization + public-key                     │
│     └─> Parse: data.attributes.{latitude, longitude, ...}       │
│                                                                 │
│  3. Atualiza banco local:                                       │
│     ├─> ultima_posicao_lat, ultima_posicao_lng                  │
│     ├─> ultima_velocidade, ultima_ignicao                       │
│     └─> ultima_comunicacao = data_posicao                       │
│                                                                 │
│  4. Mapa exibe veículo com posição ✅                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Seção Técnica: Código Completo

### sync-rastreadores/index.ts - syncSoftruck (linhas 153-264)

```typescript
async function syncSoftruck(
  rastreadores: Rastreador[],
  config: PlataformaConfig,
  supabase: any
): Promise<{ posicoes: Posicao[]; result: SyncResult }> {
  const result: SyncResult = {
    plataforma: "softruck",
    total: rastreadores.length,
    sucesso: 0,
    falhas: 0,
    erros: [],
  };
  const posicoes: Posicao[] = [];

  if (!config.enabled) {
    result.erros.push("API Softruck não configurada (secrets faltando)");
    result.falhas = rastreadores.length;
    return { posicoes, result };
  }

  let tokenRenovado = false;
  let token: string;

  try {
    token = await getSoftruckToken(supabase, config, false);

    for (const rast of rastreadores) {
      let tentativas = 0;
      const maxTentativas = 2;
      
      while (tentativas < maxTentativas) {
        tentativas++;
        
        try {
          // Usar IDs corretos da plataforma
          const vehicleId = rast.plataforma_veiculo_id || rast.id_plataforma;
          const deviceId = rast.plataforma_device_id || rast.id_plataforma;
          
          if (!vehicleId || !deviceId) {
            throw new Error("IDs de veículo/device não configurados");
          }
          
          // Endpoint correto conforme documentação Softruck
          const url = `${config.baseUrl}/vehicles/${vehicleId}/tracking/${deviceId}?format=JSON`;
          
          console.log(`[Softruck] Buscando posição: ${rast.codigo} (tentativa ${tentativas})`);
          
          const response = await fetch(url, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${token}`,
              "public-key": config.publicKey || "",
              "Content-Type": "application/json",
            },
          });

          if (response.status === 401) {
            console.warn(`[Softruck] Erro 401 para ${rast.codigo}`);
            
            if (tentativas < maxTentativas) {
              token = await getSoftruckToken(supabase, config, true);
              tokenRenovado = true;
              continue;
            }
            
            throw new Error(`Token inválido após ${maxTentativas} tentativas`);
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          
          // Formato correto da API v2: data.attributes
          const gpsData = data.data?.attributes || data.data;

          if (gpsData && gpsData.latitude && gpsData.longitude) {
            posicoes.push({
              rastreador_id: rast.id,
              latitude: parseFloat(gpsData.latitude),
              longitude: parseFloat(gpsData.longitude),
              velocidade: parseInt(gpsData.speed || 0),
              ignicao: Boolean(gpsData.ignition),
              data_posicao: gpsData.timestamp || new Date().toISOString(),
              odometro: gpsData.odometer || undefined,
              direcao: gpsData.course || gpsData.heading || undefined,
              bateria_nivel: gpsData.battery || undefined,
            });
            result.sucesso++;
            console.log(`[Softruck] ${rast.codigo}: lat=${gpsData.latitude}, lng=${gpsData.longitude}`);
          } else {
            result.falhas++;
            result.erros.push(`${rast.codigo}: Sem dados de posição na resposta`);
          }
          
          break;
          
        } catch (error: unknown) {
          if (tentativas >= maxTentativas) {
            result.falhas++;
            const errorMessage = error instanceof Error ? error.message : String(error);
            result.erros.push(`${rast.codigo}: ${errorMessage}`);
            console.error(`[Softruck] Erro ${rast.codigo}:`, error);
          }
        }
      }
      
      // Rate limiting: delay entre requisições
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    if (tokenRenovado) {
      console.log("[Softruck] Token foi renovado durante sincronização");
    }
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.erros.push(`Erro geral: ${errorMessage}`);
    result.falhas = rastreadores.length;
    console.error("[Softruck] Erro geral:", error);
  }

  return { posicoes, result };
}
```

## Resumo das Alterações

| Item | Alteração |
|------|-----------|
| **Endpoint** | `/tracking/gps-data` → `/vehicles/{id}/tracking/{id}` |
| **Header** | Adicionar `public-key` obrigatório |
| **Query** | Adicionar `?format=JSON` |
| **Response** | Parse `data.attributes` em vez de `data[0]` |
| **Interface** | Adicionar `plataforma_veiculo_id` |
| **Rate limit** | Adicionar delay de 200ms entre requisições |

## Resultado Esperado

Após as correções:
1. `sync-rastreadores` buscará posição corretamente da API Softruck
2. Banco local será atualizado com `ultima_posicao_lat/lng`
3. Mapa exibirá o veículo Toyota Corolla LTB4J74 com posição real
4. Status mudará de "Sem dados" para "Online"
