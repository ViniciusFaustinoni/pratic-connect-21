

# Plano: Corrigir Rotas e Historico de Rastreador

## Diagnostico

Identifiquei 3 problemas raiz que impedem o funcionamento das rotas:

### Problema 1: Join falho na edge function `historico-posicoes`
A funcao que busca o historico do associado faz um JOIN inline com `rastreadores_config_plataformas`:
```
.select(`*, config_plataforma:rastreadores_config_plataformas(*)`)
.eq('veiculo_id', veiculo_id)
.maybeSingle();
```
Esse join pode falhar silenciosamente se a FK nao estiver configurada corretamente. A funcao `rastreador-historico` (que funciona para sinistros) ja foi corrigida anteriormente para fazer **queries separadas** - mas `historico-posicoes` nao foi atualizada.

### Problema 2: Parametros Softruck inconsistentes entre edge functions
- `rastreador-historico` usa: `filters[acc][btw]=inicio,fim`
- `historico-posicoes` usa: `filters[start_date]=... & filters[end_date]=...`

Parametros diferentes para a mesma API, um deles esta errado e retorna 0 pontos.

### Problema 3: OSRM API publica sem timeout
O `routingService.ts` chama `router.project-osrm.org` (servidor demo publico) sem timeout. Se a API demora ou esta fora, o `useRotaReal` fica em loading infinito, e a `ComparacaoPosicoes` nunca desenha a rota.

## Correcoes

### 1. `supabase/functions/historico-posicoes/index.ts`
- Separar query do rastreador e da config da plataforma em 2 chamadas independentes (mesmo padrao do `rastreador-historico`)
- Padronizar filtros Softruck para usar o mesmo formato do `rastreador-historico` (que ja funciona para posicao atual)
- Usar `plataforma_veiculo_id || plataforma_device_id || id_plataforma` (mesma cadeia de fallback)

### 2. `src/services/routingService.ts`
- Adicionar `AbortController` com timeout de 8 segundos na chamada OSRM
- Garantir que o fallback (linha reta + Haversine) funcione corretamente em caso de timeout

### 3. `src/hooks/useRotaReal.ts`
- Remover o `lastRequestRef` que impede retentativas quando coordenadas mudam minimamente
- Usar dependencias estabilizadas com `toFixed(4)` para evitar re-renders desnecessarios mas permitir retry apos erro

