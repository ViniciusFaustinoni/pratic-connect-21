

# Revisao Completa - Fluxo de Consulta de Posicao na Rede Veiculos

## Resumo Executivo

| Item | Status | Detalhes |
|------|--------|----------|
| Endpoint POST /obterUltimaPosicaoValida | **NAO USADO** | Sistema usa GET /veiculos/{id}/posicao em vez disso |
| Consulta quando associado abre tela de rastreamento | **IMPLEMENTADO** | Via `posicao-veiculo` Edge Function |
| Consulta quando analista visualiza mapa | **PARCIAL** | Usa RPC `get_ultimas_posicoes` (dados locais, nao API em tempo real) |
| Consulta quando ha solicitacao de Assistencia 24h | **IMPLEMENTADO** | Via `posicao-veiculo` na edge function `criar-chamado-assistencia` |
| Consulta quando ha comunicado de sinistro | **PARCIAL** | Usa ultima posicao do banco, nao busca tempo real |
| Identificador do veiculo enviado corretamente | **SIM** | Usa `rastreador.codigo` ou `id_plataforma` |
| Latitude/longitude retornada e exibida no mapa | **SIM** | Mapeamento correto de campos |
| Data/hora da posicao mostrada ao usuario | **SIM** | Via `data_hora` e calculo de tempo |
| Posicoes antigas sinalizadas como desatualizada | **IMPLEMENTADO** | Via status `online/atencao/offline` |

---

## Analise Detalhada

### 1. Estado Atual da Integracao Rede Veiculos

O sistema possui **duas Edge Functions** que consultam posicao:

| Edge Function | Uso Principal | Suporte Rede Veiculos |
|---------------|---------------|----------------------|
| `posicao-veiculo` | App do Associado | **SIM** - linha 195-232 |
| `rastreador-posicao` | Painel Administrativo | **PARCIAL** - apenas Softruck |

#### 1.1 Implementacao em `posicao-veiculo` (CORRETO)

```typescript
// supabase/functions/posicao-veiculo/index.ts - linhas 379-394
if (plataformaCodigo === 'rede_veiculos') {
  const redeToken = Deno.env.get('REDE_VEICULOS_TOKEN');
  const baseUrl = plataforma?.ambiente_atual === 'producao'
    ? plataforma?.api_url_producao
    : plataforma?.api_url_sandbox;

  posicao = await getPosicaoRedeVeiculos(
    redeToken,
    rastreador.codigo,  // Identificador do veiculo
    baseUrl
  );
}
```

**Endpoint chamado:** `GET /veiculos/{codigo}/posicao`

#### 1.2 Implementacao em `rastreador-posicao` (INCOMPLETO)

Esta edge function **APENAS** suporta Softruck - nao tem suporte para Rede Veiculos:

```typescript
// supabase/functions/rastreador-posicao/index.ts - linha 215
// Buscar posicao com retry automatico em erro 401 (APENAS SOFTRUCK)
const posicao = await getPosicaoSoftruckComRetry(...)
```

**Gap identificado:** Nenhum tratamento para `rede_veiculos` nesta edge function.

### 2. Cenarios de Consulta de Posicao

#### 2.1 Associado Abre Tela de Rastreamento no App

**Arquivo:** `src/pages/app/AppRastreamento.tsx` (linha 139)

```typescript
const { posicao, tempoReal, offline, refetch, atualizarManual } = 
  useVeiculoPosicao(vehicle?.id);
```

**Hook:** `src/hooks/useMyData.ts` (linhas 251-300)

```typescript
export function useVeiculoPosicao(veiculoId?: string) {
  const query = useQuery({
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('posicao-veiculo', {
        body: { veiculo_id: veiculoId }
      });
      // ...
    },
    refetchInterval: 30000,  // Auto-refresh a cada 30s
  });
}
```

**Status:** IMPLEMENTADO - A edge function `posicao-veiculo` roteeia corretamente entre Softruck e Rede Veiculos.

#### 2.2 Analista Visualiza Mapa de Monitoramento

**Hook:** `src/hooks/useRastreadorPosicao.ts` (linhas 178-189)

```typescript
export function useTodasPosicoesAtuais() {
  return useQuery({
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_ultimas_posicoes');
      return data as PosicaoAtual[];
    },
    refetchInterval: 60000,  // A cada 60s
  });
}
```

**Status:** PARCIAL - Usa dados **locais** (RPC no banco), nao busca posicao em tempo real via API.

**Gap:** O mapa do analista mostra posicoes sincronizadas pelo `sync-rastreadores` (cron a cada minuto), nao posicao em tempo real da plataforma.

#### 2.3 Solicitacao de Assistencia 24h

**Arquivo:** `supabase/functions/criar-chamado-assistencia/index.ts` (linhas 218-230)

```typescript
// Tentar buscar posicao em tempo real via API
if (rastreador.plataforma === 'softruck' && rastreador.plataforma_veiculo_id) {
  const posicaoResult = await fetch(
    `${supabaseUrl}/functions/v1/posicao-veiculo`,
    {
      method: 'POST',
      body: JSON.stringify({ veiculo_id: veiculo.id }),
    }
  );
  // ...
}
```

**Gap Identificado:** Condicao `rastreador.plataforma === 'softruck'` - Nao busca posicao para Rede Veiculos!

**Arquivo:** `src/pages/public/TrackingAssistencia.tsx` (linhas 85-96)

```typescript
if (chamadoData.veiculo?.id) {
  const { data: posicaoResult } = await supabase.functions.invoke('posicao-veiculo', {
    body: { veiculo_id: chamadoData.veiculo.id },
  });
}
```

**Status:** IMPLEMENTADO - Esta pagina publica busca posicao sem filtrar plataforma.

#### 2.4 Comunicado de Sinistro

**Arquivo:** `supabase/functions/criar-sinistro/index.ts` (linhas 235-240)

```typescript
// Buscar rastreador do veiculo
const { data: rastreador } = await supabaseAdmin
  .from('rastreadores')
  .select('id, codigo, plataforma, ultima_posicao_lat, ultima_posicao_lng, ultima_comunicacao')
  .eq('veiculo_id', payload.veiculo_id)
  .eq('status', 'instalado')
  .maybeSingle();
```

**Status:** PARCIAL - Usa ultima posicao **do banco** (campo `ultima_posicao_lat/lng`), nao busca em tempo real.

**Implicacao:** Se o rastreador nao sincronizou recentemente, a posicao pode estar desatualizada.

### 3. Sinalizacao de Posicoes Desatualizadas

#### 3.1 Backend - Calculo de Status

**Arquivo:** `supabase/functions/posicao-veiculo/index.ts` (linhas 51-61)

```typescript
function calcularStatusRastreador(ultimaComunicacao: string | null): 'online' | 'offline' | 'atencao' {
  if (!ultimaComunicacao) return 'offline';
  
  const diffMinutos = (agora.getTime() - ultima.getTime()) / 60000;
  
  if (diffMinutos < 10) return 'online';     // < 10 min = online
  if (diffMinutos < 60) return 'atencao';    // < 1h = atencao
  return 'offline';                           // > 1h = offline
}
```

#### 3.2 Frontend - Exibicao do Status

**Arquivo:** `src/pages/app/AppRastreamento.tsx` (linhas 157-181)

```typescript
// Calcular horas sem comunicacao
const horasSemCom = ultimaCom 
  ? Math.floor((Date.now() - new Date(ultimaCom).getTime()) / (1000 * 60 * 60)) 
  : null;

// Exibir tempo desde atualizacao
if (diffMin < 1) setTempoDesdeAtualizacao('agora');
else if (diffMin < 60) setTempoDesdeAtualizacao(`ha ${diffMin} min`);
else if (diffMin < 1440) setTempoDesdeAtualizacao(`ha ${Math.floor(diffMin / 60)}h`);
else setTempoDesdeAtualizacao(`ha ${Math.floor(diffMin / 1440)}d`);
```

**Overlays para estados especificos (linhas 329-362):**

| Status | Overlay | Mensagem |
|--------|---------|----------|
| Aguardando primeira posicao | Azul pulsante | "Aguardando primeira posicao GPS" |
| Sem comunicacao > 4h | Vermelho | "O rastreador nao comunica ha Xh" |
| Offline curto periodo | Amarelo | "Rastreador offline - Ultima posicao: ha X" |

**Status:** IMPLEMENTADO - Sistema sinaliza corretamente posicoes antigas.

---

## Gaps Identificados

### Gap 1: `rastreador-posicao` nao suporta Rede Veiculos

Esta edge function so funciona com Softruck. Precisamos adicionar:

```typescript
// Adicionar em rastreador-posicao/index.ts
if (plataformaCodigo === 'rede_veiculos') {
  const redeToken = Deno.env.get('REDE_VEICULOS_TOKEN');
  const baseUrl = plataforma.ambiente_atual === 'producao'
    ? plataforma.api_url_producao
    : plataforma.api_url_sandbox;

  const url = `${baseUrl}/veiculos/${rastreador.codigo}/posicao`;
  // ... fetch e mapear resposta
}
```

### Gap 2: `criar-chamado-assistencia` filtra apenas Softruck

A condicao `if (rastreador.plataforma === 'softruck')` exclui Rede Veiculos:

```typescript
// ATUAL (incorreto)
if (rastreador.plataforma === 'softruck' && rastreador.plataforma_veiculo_id) {

// CORRIGIDO
if (rastreador && (rastreador.plataforma === 'softruck' || rastreador.plataforma === 'rede_veiculos')) {
```

### Gap 3: `criar-sinistro` nao busca posicao em tempo real

Atualmente usa apenas `ultima_posicao_lat/lng` do banco. Deveria:

```typescript
// Tentar buscar posicao em tempo real para evidencia
if (rastreador) {
  try {
    const { data: posicaoReal } = await supabase.functions.invoke('posicao-veiculo', {
      body: { veiculo_id: payload.veiculo_id },
    });
    if (posicaoReal?.success && posicaoReal?.posicao) {
      rastreadorLat = posicaoReal.posicao.latitude;
      rastreadorLng = posicaoReal.posicao.longitude;
      rastreadorPosicaoCapturadaEm = posicaoReal.posicao.data_hora;
    }
  } catch { /* fallback para banco */ }
}
```

### Gap 4: Mapa do analista nao busca tempo real

O hook `useTodasPosicoesAtuais` usa RPC local. Para tempo real, precisaria chamar a API para cada veiculo (pode ser custoso).

**Recomendacao:** Manter como esta (sync via cron) mas adicionar botao "Atualizar Agora" que chama `sync-rastreadores`.

---

## Plano de Correcao

### Fase 1: Corrigir `rastreador-posicao` para suportar Rede Veiculos

**Modificar:** `supabase/functions/rastreador-posicao/index.ts`

Adicionar funcao `getPosicaoRedeVeiculos` e logica de roteamento por plataforma.

### Fase 2: Corrigir `criar-chamado-assistencia`

**Modificar:** `supabase/functions/criar-chamado-assistencia/index.ts`

Remover filtro `plataforma === 'softruck'` e usar `posicao-veiculo` para ambas plataformas.

### Fase 3: Corrigir `criar-sinistro`

**Modificar:** `supabase/functions/criar-sinistro/index.ts`

Adicionar chamada a `posicao-veiculo` para obter posicao em tempo real como evidencia.

### Fase 4: (Opcional) Adicionar botao "Atualizar Posicoes" no mapa do analista

**Modificar:** Componente do mapa de monitoramento

Adicionar botao que chama `useSyncRastreadores` para forcar atualizacao.

---

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/rastreador-posicao/index.ts` | Adicionar suporte Rede Veiculos |
| `supabase/functions/criar-chamado-assistencia/index.ts` | Remover filtro de plataforma |
| `supabase/functions/criar-sinistro/index.ts` | Buscar posicao tempo real |

---

## Checklist de Verificacao

- [x] Associado abre tela de rastreamento - posicao Rede Veiculos funciona
- [x] Posicao retornada com latitude/longitude
- [x] Data/hora da posicao exibida ao usuario
- [x] Posicoes antigas sinalizadas como offline/atencao
- [ ] `rastreador-posicao` suporta Rede Veiculos
- [ ] Assistencia 24h busca posicao Rede Veiculos
- [ ] Sinistro busca posicao em tempo real

---

## Teste Recomendado: Consulta de Posicao

### Pre-requisitos

1. 3 veiculos com rastreadores Rede Veiculos instalados
2. `REDE_VEICULOS_TOKEN` valido e configurado
3. Acesso ao app do associado

### Passos do Teste

1. **Login como associado no App** (`/app/login`)
2. **Acessar Rastreamento** (`/app/rastreamento`)
3. **Verificar posicao do veiculo:**
   - Mapa exibe marcador na posicao correta
   - Data/hora da ultima atualizacao visivel
   - Status do rastreador (online/atencao/offline)
4. **Clicar "Atualizar"**
5. **Verificar que posicao e atualizada**
6. **Repetir para os outros 2 veiculos**

### Resultado Esperado

- Todos os 3 veiculos exibem posicao no mapa
- Data/hora da posicao e exibida (formato "agora", "ha X min", etc)
- Posicoes antigas mostram status "atencao" ou "offline"
- Atualizacao manual funciona

