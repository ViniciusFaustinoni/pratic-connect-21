

# Sync Automatico de Posicoes a Cada 10 Minutos

## Resumo

Agendar o `sync-rastreadores` existente via `pg_cron` para rodar a cada 10 minutos, com otimizacoes para escala futura e politica de retencao de dados.

---

## 1. Cron Job (pg_cron + pg_net)

Agendar chamada a `sync-rastreadores` a cada 10 minutos. Nao precisa de nova edge function — a existente ja faz tudo (busca posicoes da Softruck e Rede Veiculos, salva em `rastreador_posicoes`, atualiza `rastreadores` via trigger).

SQL a executar no SQL Editor (nao como migracao):

```text
SELECT cron.schedule(
  'sync-rastreadores-10min',
  '*/10 * * * *',
  $$ SELECT net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/sync-rastreadores',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb,
    body := '{"time":"now"}'::jsonb
  ) AS request_id; $$
);
```

Resultado: o sistema coleta posicao de todos os rastreadores instalados a cada 10 minutos, automaticamente. Cada posicao e salva no historico e a ultima posicao e atualizada no rastreador (trigger ja existe).

---

## 2. Politica de Retencao de Dados

Para evitar crescimento descontrolado da tabela `rastreador_posicoes`, criar um cron de limpeza diaria que remove posicoes com mais de 90 dias (configuravel):

SQL adicional:

```text
SELECT cron.schedule(
  'limpar-posicoes-antigas',
  '0 3 * * *',  -- todo dia as 03:00 UTC
  $$ DELETE FROM rastreador_posicoes WHERE data_posicao < now() - interval '90 days'; $$
);
```

Isso mantem a tabela sempre com no maximo ~90 dias de historico. Para dados mais antigos, pode-se criar uma tabela de arquivo ou exportar antes da limpeza.

---

## 3. Otimizacao da Edge Function para Escala (futuro)

Quando o numero de rastreadores crescer acima de ~200, a edge function atual pode atingir timeout (60s). Nesse cenario, a otimizacao seria:

- Processar em lotes de 50 rastreadores por invocacao
- O cron chamaria a funcao multiplas vezes com offset/lote
- Ou migrar para chamadas bulk da API Softruck (se disponivel)

Isso NAO e necessario agora (1 rastreador instalado) e pode ser implementado quando a base crescer.

---

## Nenhum arquivo a criar ou modificar

A edge function `sync-rastreadores` ja existe e funciona. A unica acao e executar os SQLs de agendamento no SQL Editor do Supabase.

---

## Projecao de impacto

Com 1 rastreador: 144 posicoes/dia, ~4.300/mes (~1 MB). Impacto zero.

Com 100 rastreadores: ~430.000 posicoes/mes (~100 MB). Tranquilo para Supabase.

Com a politica de retencao de 90 dias, a tabela nunca ultrapassara ~1.3M linhas (100 rastreadores) — perfeitamente gerenciavel com os indices ja existentes.

