

# Plano: Remover sync em massa e buscar posição apenas sob demanda

## Contexto

Atualmente o `sync-rastreadores` roda a cada 10 minutos via cron, buscando posições de ~8.000 rastreadores em lotes de 200. Isso gera milhares de chamadas de API desnecessárias. O mapa (`/monitoramento/mapa`) já usa a edge function `rastreador-posicao` para buscar posição individual sob demanda.

## O que será removido

1. **Cron job** `sync-rastreadores-10min` — nova migration para desagendar
2. **Busca em massa de posições** — remover de `sync-rastreadores/index.ts` toda a lógica de fetch de tracking (Softruck e Rede Veículos) em loop
3. **Hook `useTodasPosicoesAtuais`** — remover o polling automático de 60s (não é usado em nenhuma página)
4. **Hook `useSyncRastreadores`** — remover invocação manual do sync em massa (usado em ConfigPlataformas e PlataformasConfigPanel)
5. **Amostragem de status "offline"** — remover o `refetchInterval` dos hooks de alertas em `useRastreadorPosicao.ts`

## O que será mantido

- **Edge function `rastreador-posicao`** — já busca posição individual sob demanda (usada no mapa ao clicar em um veículo)
- **Edge function `sync-rastreadores`** — será simplificada para manter APENAS a resolução de IMEIs brutos (Correção 2) sem buscar posições. Pode ser invocada manualmente quando necessário
- **`view_rastreadores_posicao`** — a view do banco que mostra dados já salvos (usada na busca do mapa)
- **Tabela `rastreador_posicoes`** — mantida para histórico de trajetos

## Alterações

### 1. Nova migration: Desagendar cron
Criar migration SQL:
```sql
SELECT cron.unschedule('sync-rastreadores-10min');
```

### 2. Simplificar `sync-rastreadores/index.ts`
Remover:
- `syncSoftruck()` — toda a busca de tracking (linhas 325-514)
- `syncRedeVeiculos()` — toda a busca de posição (linhas 516-634)
- `atualizarUltimaComunicacao()` — atualização em massa (linhas 640-675)
- Round-robin de posições e inserção de posições no handler principal
- Limpeza de posições antigas

Manter apenas:
- `resolveImeiToDeviceId()` — resolução de IMEIs brutos
- `getPlataformasConfigFromDB()` — config do banco
- Handler simplificado que aceita chamadas manuais para resolver IMEIs pendentes (sem buscar posições)

### 3. Limpar hooks em `src/hooks/useRastreadorPosicao.ts`
- Remover `useTodasPosicoesAtuais` (sem uso em páginas)
- Remover `useSyncRastreadores` (sync em massa não existe mais)
- Remover `refetchInterval: 30000` de `useAlertasContagem` e `useRastreadorAlertas`

### 4. Atualizar páginas que usam `useSyncRastreadores`
- `src/pages/monitoramento/ConfigPlataformas.tsx` — remover botão de sync manual
- `src/components/rastreadores/PlataformasConfigPanel.tsx` — remover botão de sync manual

### 5. O mapa continua funcionando como está
O `Mapa.tsx` já busca posição sob demanda via `rastreador-posicao` quando o usuário clica "Atualizar" em um veículo. A busca por placa consulta `view_rastreadores_posicao` (dados locais do banco).

## Arquivos alterados
- `supabase/functions/sync-rastreadores/index.ts` — simplificar (só resolução de IDs)
- `src/hooks/useRastreadorPosicao.ts` — remover hooks de sync/polling
- `src/pages/monitoramento/ConfigPlataformas.tsx` — remover botão sync
- `src/components/rastreadores/PlataformasConfigPanel.tsx` — remover botão sync
- Nova migration SQL — desagendar cron

