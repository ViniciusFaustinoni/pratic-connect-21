

# Fase 4-5: Automacao da Fila de Trabalho e Motor de Execucao da Regua

## Resumo

Implementar os dois gaps mais criticos restantes: a geracao automatica de tarefas na fila de trabalho (Gap 4) e o motor de execucao da regua de cobranca (Gap 7). Juntos, eles transformam o modulo de cobranca de manual para automatizado.

---

## 1. Motor de Execucao da Regua (Gap 7)

### Edge Function: `executar-regua-cobranca`

Funcao que roda diariamente via cron e executa a logica central da cobranca automatizada:

**Fluxo:**
1. Busca a regua ativa em `reguas_cobranca`
2. Busca todos os boletos vencidos e nao pagos em `cobrancas` (status pendente/vencido, data_vencimento < hoje)
3. Agrupa por `associado_id` e calcula dias de atraso (baseado no boleto mais antigo)
4. Para cada associado inadimplente, verifica qual etapa da regua corresponde ao dia de atraso
5. Verifica se a etapa ja foi executada consultando `cobranca_eventos` (evita duplicidade)
6. Executa a acao conforme o tipo da etapa:
   - **WhatsApp/SMS/Email (automatico):** Registra evento em `cobranca_eventos` com tipo e subtipo. A integracao real com Evolution API/Resend sera via funcoes ja existentes (`gerar-mensagem-whatsapp`). Nesta fase, registra o evento e marca como "agendado para envio".
   - **Ligacao (manual):** Cria tarefa em `cobranca_fila` com motivo "regua_ligacao", prioridade calculada pelo dia de atraso
   - **Suspensao (D+0):** Registra evento de suspensao em `cobranca_eventos`
   - **Negativacao (D+30/60):** Cria tarefa urgente em `cobranca_fila` com motivo "decisao_negativacao"
   - **Cancelamento (D+90/120):** Cria tarefa urgente em `cobranca_fila` com motivo "decisao_exclusao"

**Prevencao de duplicidade:**
- Antes de criar qualquer tarefa ou evento, verifica se ja existe um `cobranca_eventos` com mesmo `associado_id`, `tipo` e dia de atraso correspondente nos ultimos 7 dias
- Antes de criar tarefa na fila, verifica se ja existe uma `cobranca_fila` pendente para o mesmo associado com mesmo motivo

**Prioridade calculada:**
- D+0 a D+5: prioridade 3 (baixa)
- D+6 a D+15: prioridade 5 (normal)
- D+16 a D+30: prioridade 7 (alta)
- D+30+: prioridade 9 (urgente)
- Valor > R$ 2.000: +1 na prioridade

### Cron Job (via pg_cron + pg_net)

Agendar a edge function para rodar 1x por dia as 07:00 (antes do expediente). Usar SQL com `cron.schedule` para chamar a funcao via `net.http_post`.

---

## 2. Geracao Automatica da Fila (Gap 4)

### Edge Function: `gerar-fila-cobranca`

Funcao complementar que pode ser chamada manualmente ou pelo cron, focada em gerar tarefas de follow-up:

**Tarefas geradas automaticamente:**
- **Promessa quebrada:** Se um contato em `cobranca_contatos` registrou `resultado = 'promessa_pagamento'` com `data_promessa` ja passada e o boleto continua vencido, cria tarefa com motivo `promessa_quebrada` (prioridade 8)
- **Acordo com parcela vencendo hoje:** Busca `acordo_parcelas` com `data_vencimento = hoje` e status `pendente`, cria tarefa com motivo `parcela_vencendo` (prioridade 5)
- **Retorno agendado:** Busca `cobranca_contatos` com `data_retorno = hoje`, cria tarefa com motivo `retorno_agendado` (prioridade 7)
- **Sem contato ha muito tempo:** Inadimplentes com ultimo contato ha mais de 15 dias e sem acordo ativo, cria tarefa com motivo `sem_contato` (prioridade 6)

**Prevencao de duplicidade:** Mesma logica — verifica se ja existe tarefa pendente para o mesmo associado/motivo antes de criar.

---

## 3. Melhorias na UI da Fila de Trabalho

### Barra de Progresso e Meta Diaria

Adicionar ao header da `FilaTrabalho.tsx`:
- Barra de progresso visual: `concluidos_hoje / total_dia` com cores (verde > 80%, amarelo > 50%, vermelho < 50%)
- Meta diaria: "X de 30 contatos" (meta configuravel, default 30)
- Card adicional "Meta Diaria" com icone de alvo

### Metricas do Operador (rodape)

Novo componente `MetricasOperador.tsx` no rodape da fila:
- Contatos hoje: total de `cobranca_contatos` criados pelo usuario hoje
- Taxa de contato efetivo: contatos com `resultado != 'nao_atendeu'` / total contatos
- Taxa de conversao: contatos que resultaram em pagamento ou acordo / total contatos (ultimos 30 dias)
- Tempo medio por tarefa: diferenca entre `concluido_em` e `created_at` das tarefas concluidas hoje

### Botao "Gerar Fila do Dia"

Botao no header que chama a edge function `gerar-fila-cobranca` manualmente, para quando o operador quer forcar a atualizacao da fila.

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/executar-regua-cobranca/index.ts` | Motor de execucao da regua — roda via cron diario |
| `supabase/functions/gerar-fila-cobranca/index.ts` | Gerador de tarefas de follow-up para a fila |
| `src/components/cobranca/MetricasOperador.tsx` | Metricas do operador no rodape da fila |

## Arquivos a Modificar

| Arquivo | Mudancas |
|---------|----------|
| `supabase/config.toml` | Adicionar config das 2 novas edge functions |
| `src/pages/cobranca/FilaTrabalho.tsx` | Barra de progresso, meta diaria, botao gerar fila, metricas |

## Migracao de Banco

Nenhuma nova tabela necessaria. As tabelas `cobranca_fila`, `cobranca_eventos` e `cobranca_contatos` ja existem com todos os campos necessarios.

Sera necessario rodar um SQL (nao como migracao, pois contem dados especificos do projeto) para criar o cron job via `pg_cron`:

```text
Habilitar extensoes pg_cron e pg_net no Supabase Dashboard
Depois executar SQL para agendar:
  - executar-regua-cobranca: diario as 07:00
  - gerar-fila-cobranca: diario as 07:05
  - verificar-acordos-quebrados: diario as 07:10
```

## Detalhes Tecnicos

- Edge functions usam `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (ja disponiveis)
- Prevencao de duplicidade garante idempotencia (pode rodar multiplas vezes sem efeito colateral)
- A funcao `executar-regua-cobranca` processa em lotes de 100 inadimplentes para evitar timeout
- Logs detalhados com `console.log` para cada acao tomada (visivel nos Edge Function logs)
- Nenhuma integracao externa nova necessaria — WhatsApp/email ficam como eventos registrados, prontos para integracao futura com Evolution API/Resend
- Metricas do operador usam queries com `created_at >= hoje` e filtro por `user_id`

