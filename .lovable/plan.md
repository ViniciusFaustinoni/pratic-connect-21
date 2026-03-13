
Objetivo: eliminar o “limbo” no fluxo de imprevisto e garantir o ciclo completo (checklist → decisão com ressalva/negativa → monitoramento → reagendamento → ativação da cobertura total) funcionando ponta a ponta.

Diagnóstico confirmado no código e banco:
1) Causa raiz do imprevisto: conflito de sincronização bidirecional entre `servicos` e `instalacoes`.
- Evidência real em banco: serviço com `imprevisto_registrado_em` e `imprevisto_duplo_check=true`, mas `status` ficou `em_andamento` (deveria `nao_compareceu`).
- Motivo técnico: `sync_servicos_to_instalacao()` não mapeia `nao_compareceu`, atualiza `instalacoes.updated_at` mesmo assim, e o trigger `sync_instalacao_update_to_servicos()` sobrescreve o status do serviço de volta para `em_andamento`.

2) Fluxo de reagendamento é disparado (campo `reagendamento_enviado_em` é preenchido), mas a experiência está fraca para o associado (sem feedback in-app/modal), parecendo “nada aconteceu”.

Plano de implementação:
Fase 1 — Correção estrutural do limbo (DB + sincronização)
- Ajustar a sincronização `servicos -> instalacoes` para não permitir rollback de status.
- Implementação segura (uma das duas, priorizando consistência):
  a) adicionar `nao_compareceu` em `status_instalacao` e mapear no `sync_servicos_to_instalacao`, ou
  b) impedir update em `instalacoes` quando o status novo não for mapeável (não tocar `updated_at` nesse caso).
- Endurecer `sync_instalacao_update_to_servicos` para atualizar `status` somente quando o status da instalação realmente mudou (evitar overwrite por updates colaterais).

Fase 2 — Imprevisto (UI e transição de tarefa)
- Consolidar o fechamento do imprevisto em fluxo atômico: registrar imprevisto + confirmar duplo check + status final + enqueue de próxima tarefa.
- Garantir saída automática da tela do instalador após confirmação (sem depender de estado intermediário ambíguo).
- Garantir invalidations consistentes de React Query (`tarefa-atual`, `servico-detalhes`, listas) logo após confirmação.
- Melhorar mensagens de erro/sucesso por etapa para evitar percepção de “travou”.

Fase 3 — Reagendamento do associado (processo definido)
- Manter envio do link por WhatsApp e adicionar feedback robusto:
  - registrar evento de envio/resultado;
  - fallback claro se envio falhar.
- Implementar experiência in-app para associado (modal/banner de reagendamento pendente com CTA), para atender o requisito de “abrir modal”.
- Validar criação do novo serviço reagendado e baixa do serviço original sem inconsistência de status.

Fase 4 — Revisão completa dos demais ramos
- Checklist:
  - bloqueios corretos de avanço;
  - persistência de `checklist_data` e `etapa_atual`.
- Ressalva:
  - envio para monitoramento (`pendente_monitoramento`) e polling no instalador.
- Decisão monitoramento:
  - aprovado: retorno seguro para continuação da instalação;
  - declinado: cancelamento e efeitos esperados.
- Negativa:
  - recusa com evidências/fotos;
  - encaminhamento para análise interna sem quebrar fila do instalador.
- Ativação cobertura total:
  - garantir disparo somente nos pontos pós-instalação;
  - manter template com `placa/marca/modelo` completos.

Fase 5 — Hardening operacional
- Corrigir erro já visto em logs de `processar-encaixes-automaticos` (coluna `vistorias.hora_agendada` inexistente), para não impactar automações de atribuição e evitar novos “limbos” operacionais.

Matriz de validação E2E (tela a tela):
1) Instalador / tarefa em andamento:
- Comunicar imprevisto → duplo check → status final correto → saída automática da tela → próxima tarefa/estado de espera coerente.
2) Associado:
- Recebe aviso de reagendamento (WhatsApp e/ou in-app) → abre fluxo → reage nda com sucesso.
3) Monitoramento:
- Vê corretamente casos com ressalva/negativa/imprevisto e consegue decidir sem regressão de status.
4) Fluxo feliz:
- instalação concluída → ativação rastreador/plano → template correto da cobertura 360.
5) Fluxos de exceção:
- falha de geolocalização, falha de envio de mensagem, token inválido, sem vaga por período.

Entregáveis:
- Migração SQL de correção dos triggers/status.
- Ajustes de frontend nos componentes/hook de imprevisto e experiência do associado.
- Ajustes nas consultas/invalidações de estado.
- Checklist de testes E2E com evidências de cada etapa do fluxo.

Detalhes técnicos (implementação):
- Arquivos foco:
  - `supabase/migrations/*` (sync/status entre `servicos` e `instalacoes`)
  - `src/components/vistoriador/ImprevistoBotao.tsx`
  - `src/components/vistoriador/DuploCheckImprevisto.tsx`
  - `src/hooks/useTarefaAtual.ts` e `src/hooks/useServicos.ts`
  - `src/pages/ReagendarVistoria.tsx`
  - tela app do associado (home/plano) para modal/banner de reagendamento pendente
  - `supabase/functions/enviar-link-reagendamento/index.ts`
  - `supabase/functions/processar-encaixes-automaticos/index.ts`
- Critério de aceite principal:
  - após confirmar imprevisto, o serviço não volta para `em_andamento`, sai da experiência do instalador e o associado consegue remarcar no fluxo definido.
