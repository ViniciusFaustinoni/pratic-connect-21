

# Revisao: Contato Automatico Pos-Sinistro (Prompt 1)

## Resultado da Revisao

O sistema esta **95% conforme** com os requisitos. Todos os componentes (edge functions, frontend, banco de dados) estao implementados corretamente. Ha apenas **1 problema critico** que impede o funcionamento completo do fluxo.

---

## O QUE ESTA CONFORME

| Requisito | Status | Onde |
|---|---|---|
| Agendamento automatico ao criar colisao | OK | `criar-sinistro` chama `agendar-contato-sinistro` |
| Horario: dia seguinte 08:00 Brasilia | OK | Calcula 11:00 UTC (= 08:00 BRT) |
| Link expiravel com validade de 72h | OK | `expira_em = now() + 72h` |
| Token UUID nao previsivel | OK | Coluna `token` tipo UUID com default |
| 1 link ativo por vez, anterior invalidado | OK | `gerar-link-evento` invalida ativos antes de criar |
| Calculo da cota (FIPE x % x minimo) | OK | `MAX(fipe * percentual / 100, minimo)` |
| Diferencia passeio vs aplicativo | OK | Usa `cota_app_percent/min` se `uso_aplicativo` |
| Mensagem WhatsApp com 8 pontos | OK | Confirmacao, cota, auto vistoria, B.O., relato, prazo 30 dias, conserto, link |
| Card administrativo com status/datas/etapa | OK | `EventoLinkCard.tsx` com status, progresso, botoes |
| Botao gerar novo link | OK | Chama `gerar-link-evento` |
| Status do contato WhatsApp | OK | Badge agendado/enviado/erro com datas |
| Usa dados reais da tabela `planos` | OK | Busca `cota_participacao`, `cota_minima`, etc. |
| Link como rota publica sem autenticacao | OK | `/evento/:token` e rota publica |

---

## PROBLEMA CRITICO: Cron Job NAO configurado

A edge function `cron-contato-sinistro` existe e esta correta, mas **nao ha um cron job no banco de dados** que a execute periodicamente. A tabela `cron.job` so tem o job `cron-atribuir-tarefas`.

**Impacto:** Os agendamentos sao criados na tabela `sinistro_contatos_agendados` com status "agendado", mas a function que os processa **nunca e invocada automaticamente**. O WhatsApp com o link do evento **nunca sera enviado**.

### Correcao

Criar um cron job no banco de dados que execute `cron-contato-sinistro` a cada minuto (mesma estrategia do `cron-atribuir-tarefas`):

```text
SELECT cron.schedule(
  'cron-contato-sinistro',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-contato-sinistro',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <anon_key>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

Isso sera executado via INSERT SQL (nao migration), pois contem a anon key.

---

## Resumo

Apenas 1 correcao necessaria: configurar o cron job para que os agendamentos sejam processados automaticamente. Todo o resto -- edge functions, mensagem WhatsApp, link expiravel, card administrativo, calculo da cota -- esta implementado conforme especificado.

