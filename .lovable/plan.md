## O que aconteceu com LUT8D25 (revisado)

Cotação `COT-20260530-114923367-501` / contrato `CTR-20260601115931-I2AFMT` / instalação `25ba4038-28d3-481a-8406-a6543970e05a` / prestador `2711db6e…`.

### Linha do tempo confirmada (01/06/2026)

1. 14:21–14:26 — autovistoria enxuta materializada (chassi + motor + vídeo 360°) → `vistorias.ff5c23e0` (modalidade `autovistoria`, status `aprovada`).
2. 14:55 — Cadastro aprovou documentos.
3. 15:04 — `aprovar-proposta` criou contrato aprovado + `instalacoes.25ba4038` (`status=agendada`, `data_agendada=02/06`) + `servicos.7794e6a0` (`tipo=instalacao`, `status=agendada`).
4. 15:09 — coordenador atribuiu prestador externo → instalação foi para `aguardando_prestador`.
5. **19:02–19:07** — prestador realmente fez o trabalho: subiu **30+ fotos** para `storage/vistoria-prestador-fotos/ac4f2321-2372-4424-a2d7-61d0fd1dde5f/*.jpg` (chassi, motor, capô aberto, painel completo, todas as portas, estepe, odômetro, etc.).
6. 19:08:14 — fim da vistoria. `concluir-instalacao-prestador` rodou parcialmente:
   - ✓ Gerou laudo PDF em `storage/documentos/laudos/…/Laudo_Vistoria_LUT8D25_1780340897381.pdf`.
   - ✓ Gravou log de auditoria "Vistoria prestador concluída" (com descrição em branco "— Veículo (---) —" porque o lookup já tinha falhado).
   - ✗ **NÃO** materializou a `vistorias` presencial.
   - ✗ **NÃO** atualizou `instalacoes.25ba4038.status` (segue `aguardando_prestador`, `concluida_em=NULL`).
   - ✗ **NÃO** atualizou `servicos.7794e6a0.status` (segue `agendada`).
   - ✗ `instalacao_prestador_links.ac4f2321…` não está na tabela (deletado ou nunca commitado depois do erro).

### Por que não vai para a fila de Monitoramento

A query da Aprovação de Associados filtra `servicos.tipo IN ('instalacao','vistoria_entrada') AND status='concluida'`. Como o serviço segue `agendada` e a instalação segue `aguardando_prestador`, o caso é invisível na fila — e o link público continua mostrando "Agendar Instalação" porque `etapaPendentePublica` enxerga instalação ainda não concluída.

### Causa raiz

`concluir-instalacao-prestador` rodou sem transação: subiu as fotos no Storage e gerou laudo, mas as gravações de DB (criar vistoria, fechar instalação, fechar serviço, atualizar link) falharam silenciosamente em algum ponto e ninguém abortou — exatamente o anti-padrão "Vigia universal logs_auditoria" + memória "Fotos prestador materializadas".

## Plano de ação

### 1. Hotfix do caso LUT8D25 (saneamento de dados)

Migração pontual idempotente, reconstruindo a partir do que existe no Storage:

- Criar `vistorias` presencial vinculada ao contrato/veículo/instalação `25ba4038` (modalidade `presencial`, `status=concluida`, `concluida_em=2026-06-01 19:08:14Z`, `instalacao_id=25ba4038…`, herdando contrato/cotacao/associado/veículo).
- Inserir em `vistoria_fotos` uma entrada por arquivo do bucket `vistoria-prestador-fotos/ac4f2321-…/` (tipo derivado do nome do arquivo: `chassi`, `motor`, `painel_completo`, `odometro`, `frente`, etc.).
- Vincular o laudo (`storage/documentos/laudos/…Laudo_Vistoria_LUT8D25_…pdf`) à vistoria.
- Atualizar `instalacoes.25ba4038`: `status='concluida'`, `concluida_em=2026-06-01 19:08:14Z`.
- Atualizar `servicos.7794e6a0`: `status='concluida'`, `concluida_em=2026-06-01 19:08:14Z`.
- Registrar log de auditoria explicando que é saneamento da falha de `concluir-instalacao-prestador`.

Triggers existentes (`fn_reativar_cobertura_pos_instalacao` + reconciliação pós-instalação) vão religar a cobertura e deixar o caso pronto para Monitoramento aprovar.

### 2. Hardening da edge `concluir-instalacao-prestador`

Para não voltar a acontecer:

- Envolver toda a cascata de gravação (vistoria + vistoria_fotos + update instalação + update serviço + update link) em sequência com `try/catch` e checagem de `error` em **cada** `insert/update`. Qualquer erro → 5xx com `code` claro e **não** deletar o link.
- Após gravar, **reler** `instalacoes.status` e `servicos.status` (read-back) — se não ficaram `concluida`, retornar erro e enfileirar retry em `sga_sync_queue`/fila já existente, em vez de criar fila nova.
- Garantir que o log de auditoria use `insertAuditLog` com ação canônica para o lookup de placa/veículo não falhar silencioso (o "Veículo (---)" do log atual é sintoma).
- Não confiar em `link_id` que não veio do banco — fazer `select … where id = … for update` antes de marcar concluída.

### 3. Validação

Após o hotfix:
- Conferir que `servicos.7794e6a0.status='concluida'` e `instalacoes.25ba4038.status='concluida'`.
- Conferir que LUT8D25 aparece em Monitoramento › Aprovações › Aprovação de Associados.
- Conferir que o link público de COT-20260530-114923367-501 deixa de mostrar "Agendar Instalação".
- Conferir que as fotos do prestador aparecem na tela de Aprovação (via `vistoria_fotos`).

Após o deploy da edge corrigida, monitorar próximo caso de conclusão de prestador externo para confirmar que não há mais "vistoria prestador concluída" fantasma em `logs_auditoria` sem cascata.

## Fora de escopo

- Não tocar no link público nem em `etapaPendentePublica` — o comportamento atual reflete o estado real do banco; após o hotfix, o caso some sozinho.
- Não tocar na fila do Monitoramento — o filtro está correto, só faltava o serviço estar `concluida`.
