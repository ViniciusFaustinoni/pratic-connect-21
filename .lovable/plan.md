

# Corrigir Todos os Rastreadores Softruck

## Situação Atual

| Estado | Quantidade |
|--------|-----------|
| Total Softruck instalados | 5.072 |
| Já com `plataforma_veiculo_id` | 793 (15%) |
| Sem vehicle ID, mas com placa | 4.279 (85%) |
| Sem dados para resolver | 0 |

O reconciliador `popular-ids-softruck` **já funciona** — testei agora e resolveu 5/5 via `api_device`. O problema é que ele nunca foi executado em escala.

## Plano

### 1. Executar o reconciliador em massa

Rodar `popular-ids-softruck` em batches de 30, iterando pelos 4.279 rastreadores pendentes. Cada batch leva ~6-8 segundos (30 × 200ms rate limit). Total estimado: ~143 batches, ~17 minutos.

Vou criar um script que chama a edge function em loop com offsets incrementais, aguardando cada batch completar antes de iniciar o próximo. Isso respeita o rate limit da Softruck (50 req/min) e evita timeouts.

### 2. Verificar resultados

Após o processamento, consultar o banco para confirmar quantos foram resolvidos e quantos falharam. Os que falharem serão listados com o motivo para análise individual.

### 3. Validar sincronização

Após popular os IDs, o cron `sync-rastreadores` (que roda a cada ~7 min) passará a buscar posições de todos os rastreadores corrigidos automaticamente. Verificar na próxima execução se as posições estão sendo inseridas.

## Detalhes Técnicos

- Edge function: `popular-ids-softruck` com `batch_size=30` e `offset` incremental
- Resolução via: `api_device` (busca veículo associado ao device pelo IMEI na Softruck)
- Persistência: grava `plataforma_veiculo_id` no rastreador e `softruck_vehicle_id` no veículo
- Rate limit: 200ms entre cada chamada à API Softruck dentro do batch
- Pausa de 2s entre batches para não sobrecarregar

