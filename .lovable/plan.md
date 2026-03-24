

# Detectar técnicos offline por inatividade de localização

## Problema
Quando um técnico fecha o app sem encerrar o serviço, o campo `em_servico` permanece `true` no banco. O hook `useEquipe.ts` usa apenas esse boolean para determinar se o técnico está online — nunca verifica há quanto tempo a última localização foi enviada. Resultado: técnicos aparecem "online" indefinidamente.

O técnico envia localização a cada ~5 minutos via `useIniciarServico`. Se parou de enviar há mais de 10-15 minutos, está com o app fechado.

## Solução
Duas camadas: detecção no frontend (visual) + limpeza automática no backend.

### 1. `src/hooks/useEquipe.ts` — Verificar freshness do `updated_at`

Na lógica que determina `status_operacional` (linha 177), além de checar `em_servico`, verificar se `updated_at` é recente (últimos 15 minutos). Se `em_servico=true` mas `updated_at` é antigo, marcar como `offline`.

```
if (localizacao?.em_servico) {
  const updatedAt = new Date(localizacao.updated_at).getTime();
  const agoraMs = Date.now();
  const LIMITE_INATIVIDADE_MS = 15 * 60 * 1000; // 15 minutos
  
  if (agoraMs - updatedAt > LIMITE_INATIVIDADE_MS) {
    status_operacional = 'offline'; // App provavelmente fechado
  } else {
    // lógica existente de em_andamento/em_rota/etc
  }
}
```

### 2. `src/hooks/useVistoriadoresRealtime.ts` — Mesma verificação

Aplicar a mesma lógica de freshness. Atualmente o default é `disponivel_operacional` — deve ser `offline` se `updated_at` ultrapassou o limite.

### 3. Edge Function `limpar-servico-inativo` — Limpeza automática (nova)

Criar uma Edge Function agendada (cron a cada 10 minutos) que:
- Busca registros em `vistoriadores_localizacao` com `em_servico=true` e `updated_at` mais antigo que 20 minutos
- Atualiza `em_servico=false` para esses registros
- Isso garante que mesmo sem o frontend aberto, o dado fica correto

### 4. Cron job via `pg_cron`

Agendar a Edge Function para rodar a cada 10 minutos usando `pg_cron` + `pg_net`.

## Resumo de alterações

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useEquipe.ts` | Adicionar check de freshness do `updated_at` (15 min) |
| `src/hooks/useVistoriadoresRealtime.ts` | Mesma verificação de freshness |
| `supabase/functions/limpar-servico-inativo/index.ts` | Nova Edge Function para limpar `em_servico` de registros inativos |
| Cron job (SQL insert) | Agendar execução a cada 10 minutos |

