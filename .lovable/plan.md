

# Por que só 63 rastreadores aparecem como "comunicando"

## Diagnóstico

Existem **dois problemas** que limitam o número de rastreadores com posição atualizada:

### Problema 1: Limite de 1000 registros na função `sync-rastreadores`

A edge function `sync-rastreadores` (linha 447-462) faz uma query **sem `.range()`** para buscar rastreadores instalados. O Supabase retorna no máximo 1.000 registros por padrão. Com **7.925 instalados**, apenas ~1.000 são processados por execução.

Desses ~1.000, muitos não têm `plataforma_device_id` ou `plataforma_veiculo_id`, resultando nos 63-70 que efetivamente recebem posição.

### Problema 2: Processamento sequencial com rate limit

Cada rastreador é processado individualmente com 200ms de delay (rate limiting). Para 4.255 rastreadores Softruck sincronizáveis, seriam necessários **~14 minutos** por execução — isso excede o timeout de edge functions (geralmente 60s-150s).

### Problema 3: Rede Veículos sem sincronização efetiva

Dos 2.853 Rede Veículos instalados, apenas 29 têm `plataforma_device_id`. E o filtro de validação (linha 480) exige `id_plataforma` para Rede Veículos, mas a maioria não tem esse campo preenchido.

## Plano de Correção

### 1. Paginação na busca de rastreadores (`sync-rastreadores`)
- Implementar fetch recursivo com `.range()` (igual ao padrão usado em `useRastreadoresMetricas`)
- Buscar todos os rastreadores instalados em páginas de 1000

### 2. Processamento em lotes com batch API
- **Softruck**: usar endpoint de tracking em lote (buscar posição de múltiplos veículos por chamada) em vez de 1 por 1
- Se a API não suportar batch, processar em sub-lotes de 50 por execução e usar offset rotativo (cada execução do cron processa o próximo lote)

### 3. Estratégia de execução rotativa (Round-Robin)
- Adicionar parâmetro `batch_size` (default 200) e `offset` à função
- Cada execução processa um lote diferente
- Salvar o offset atual em `rastreadores_config_plataformas` ou tabela de controle
- Com cron a cada 5 min e 200 por lote, todos os 4.255 seriam atualizados em ~2h

### 4. Corrigir filtro Rede Veículos
- Ajustar validação (linha 471-481): para `rede_veiculos`, aceitar rastreadores que tenham `imei` + veículo com `placa` + associado com `cpf` (os campos que a API realmente usa)
- Remover exigência de `id_plataforma` para Rede Veículos

### 5. Atualizar `ultima_comunicacao` no rastreador
- Após inserir posições, fazer UPDATE em batch no campo `ultima_comunicacao` dos rastreadores sincronizados
- Isso garante que as métricas reflitam o status real

### Arquivos alterados
- `supabase/functions/sync-rastreadores/index.ts` — paginação, lotes rotativos, filtro RV, update ultima_comunicacao

### Resultado esperado
- Todos os 4.255 Softruck com vehicle_id terão posição atualizada em ciclos de ~2h
- Rede Veículos passará a sincronizar os que têm IMEI + placa + CPF
- Métricas refletirão o número real de rastreadores comunicando

