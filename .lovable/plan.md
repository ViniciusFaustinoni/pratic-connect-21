

# Correção Completa: Rotas/Trajetos de Rastreador

## Problemas Identificados

### 1. CORS Incompleto (3 Edge Functions)
As funções `rastreador-historico`, `rastreador-posicao` e `rastreador-auth` usam CORS headers desatualizados. O cliente Supabase JS v2.97 envia headers adicionais (`x-supabase-client-platform`, etc.) que não estão na lista `Access-Control-Allow-Headers`, causando falha silenciosa na requisição preflight.

**Impacto**: Chamadas à API podem falhar com erro CORS sem mensagem clara no console.

### 2. Funções Ausentes no `config.toml`
As 3 funções `rastreador-historico`, `rastreador-posicao` e `rastreador-auth` **não estão** no `config.toml`. Isso significa `verify_jwt = true` por padrão. Como `rastreador-historico` chama `rastreador-auth` internamente via `fetch` com a service role key, isso pode funcionar, mas chamadas do frontend com token de usuário podem falhar dependendo da configuração do projeto.

### 3. Trajeto no Mapa de Monitoramento usa dados brutos (linha reta entre pontos GPS)
O botão "Ver Trajeto" no mapa de monitoramento (`Mapa.tsx`) busca posições da tabela `rastreador_posicoes` e desenha uma `Polyline` conectando pontos brutos — o resultado é uma linha reta entre cada ponto GPS, não uma rota seguindo ruas. Deveria usar `getRouteOSRMMultiWaypoint` do `routingService.ts` para gerar uma rota real.

### 4. Trajeto de Sinistro (TrajetoColisaoCard/TrajetoSinistroCard) — mesma limitação
Ambos os cards usam dados retornados pela edge function `rastreador-historico` e desenham `Polyline` com pontos brutos. Não usam o OSRM para traçar rotas reais entre os pontos.

## Alterações

### 1. Atualizar CORS em 3 Edge Functions

Em `rastreador-historico/index.ts`, `rastreador-posicao/index.ts` e `rastreador-auth/index.ts`, atualizar:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}
```

### 2. Adicionar ao `config.toml`

```toml
[functions.rastreador-historico]
verify_jwt = false

[functions.rastreador-posicao]
verify_jwt = false

[functions.rastreador-auth]
verify_jwt = false
```

### 3. Trajeto com rota real no Mapa de Monitoramento (`Mapa.tsx`)

Após buscar pontos da tabela `rastreador_posicoes`, chamar `getRouteOSRMMultiWaypoint` para converter os pontos brutos em uma rota real seguindo ruas. Mostrar linha tracejada enquanto carrega, depois a rota real.

### 4. Trajeto com rota real nos cards de Sinistro

Nos componentes `TrajetoColisaoCard.tsx` e `TrajetoSinistroCard.tsx`, após receber o `trajeto` da edge function, usar `getRouteOSRMMultiWaypoint` para renderizar a rota seguindo ruas em vez de pontos brutos conectados por linhas retas.

### 5. ConsultaTrajetoAvancada — mesma correção

Aplicar a mesma lógica de rota real via OSRM.

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/rastreador-historico/index.ts` | Atualizar CORS headers |
| `supabase/functions/rastreador-posicao/index.ts` | Atualizar CORS headers |
| `supabase/functions/rastreador-auth/index.ts` | Atualizar CORS headers |
| `supabase/config.toml` | Adicionar 3 funções com verify_jwt = false |
| `src/pages/monitoramento/Mapa.tsx` | Usar getRouteOSRMMultiWaypoint para trajeto real |
| `src/components/sinistros/TrajetoColisaoCard.tsx` | Usar getRouteOSRMMultiWaypoint para rota real |
| `src/components/sinistros/TrajetoSinistroCard.tsx` | Usar getRouteOSRMMultiWaypoint para rota real |
| `src/components/sinistros/ConsultaTrajetoAvancada.tsx` | Usar getRouteOSRMMultiWaypoint para rota real |

8 arquivos.

