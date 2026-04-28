## Diagnóstico — Causa Raiz

O contrato do CASSIO (`3388240f-...`, placa **LMX5A90**) foi assinado em **22/04 22:35 UTC** (≈19:35 BR), há mais de **5 dias**, e deveria ter sido suspenso pelo cron `cron-suspender-cobertura-inativacao` (executa de hora em hora, prazo padrão 72h). Não foi suspenso por **3 filtros bloqueantes** na função:

| # | Filtro na query | Valor real do contrato | Resultado |
|---|---|---|---|
| 1 | `tipo_vistoria = 'autovistoria'` | `NULL` | ❌ Excluído |
| 2 | `status = 'ativo'` | `'assinado'` | ❌ Excluído |
| 3 | (verificação de instalação) busca em `servicos` por `tipo='instalacao'` | A instalação está na tabela `instalacoes` (registro `agendada` desde 24/04 para 27/04) | ❌ Nunca encontraria mesmo se passasse |

Ou seja, a função só suspende um subconjunto muito específico (auto-vistoria + status ativo) e ignora o caminho normal de "vistoria com técnico" — que é o caso do CASSIO. Resultado: contratos como esse ficam invisíveis ao cron e nunca suspendem.

Adicionalmente, a verificação de "já instalado" consulta a tabela errada (`servicos` em vez de `instalacoes`), o que pode causar falsos negativos mesmo nos casos que entram.

## O que será corrigido

### 1. Edge function `cron-suspender-cobertura-inativacao`
- **Remover** o filtro `tipo_vistoria = 'autovistoria'` — a regra dos 48h vale para todos os tipos de vistoria/instalação (memória `suspensao-cobertura-48h`).
- **Ampliar** o filtro de status para incluir contratos `assinado` e `ativo` (ambos representam contratos válidos aguardando instalação).
- **Trocar a fonte de verdade da instalação**: verificar tabela `instalacoes` (status `concluida` ou `concluida_em IS NOT NULL`) em vez de `servicos`. Manter `servicos` como fallback para retrocompatibilidade.
- **Ignorar** instalações com `dispensa_rastreador = true` (não exigem rastreador, então não devem suspender).
- Atualizar a mensagem de WhatsApp para ser genérica ("instalação não realizada no prazo") em vez de citar auto-vistoria.

### 2. Reprocessamento manual
Após o deploy, invocar a função uma vez para processar o backlog acumulado (CASSIO e quaisquer outros contratos assinados há mais de 72h sem instalação concluída). Retornar a lista no resultado para auditoria.

### 3. Atualizar memória
Atualizar `mem://logic/operations/suspensao-cobertura-48h` para refletir que a regra cobre **todos** os contratos assinados (não só auto-vistoria) e que a fonte de verdade da instalação é a tabela `instalacoes`.

## Fora do escopo
- Não mexer no agendamento do cron (já roda de hora em hora — OK).
- Não mexer no parâmetro `prazo_instalacao_autovistoria_horas` (continua configurável pela diretoria; default 72h).
- Não criar novas tabelas nem migrations — só edge function + reprocessamento.

## Resultado esperado
Após a correção, na próxima execução horária (ou no reprocessamento manual) o veículo **LMX5A90** terá `cobertura_suspensa = true`, badge "Suspensa" aparecerá no header, e o WhatsApp de aviso será enviado ao CASSIO. O mesmo passará a valer para qualquer contrato futuro assinado e não instalado dentro do prazo.