
## Diagnóstico

A cotação `COT-20260528-110546183-838` travou na última tela do link público (Confirmar Agendamento) com:

> agendamento_base bloqueado: contrato da cotação … ainda não foi aprovado pelo Cadastro

Origem: trigger `trg_guard_agendamento_base_exige_cadastro_aprovado` (migration `20260526161640_…`), que faz `RAISE EXCEPTION` se `agendamentos_base` for criado antes de `contratos.aprovado_em`.

Isso **inverte a regra canônica**:

- O link público é o **módulo do associado**. Ele deve poder percorrê-lo do início ao fim sem nenhum bloqueante de módulo posterior (Cadastro, Monitoramento, etc.).
- Cadastro só passa a **ver** a proposta depois que o associado fecha o link público inteiro — não antes, nem por intermédio de bloqueios.
- "Fim do link público" **não é sempre o agendamento**. Depende do fluxo:
  - Acima da FIPE, presencial: termina no **agendamento da instalação/vistoria**.
  - Sub-FIPE: termina na **autovistoria completa** (não há agendamento).
  - Troca de titularidade dentro da janela: pode terminar na **assinatura + pagamento**, sem vistoria.
  - 0KM: segue a regra do FIPE correspondente.

A regra correta, escrita sem ambiguidade:

> **Nenhuma ação do link público pode ser bloqueada por estado de módulo posterior.** O gate Cadastro→Monitoramento, e qualquer outro gate entre módulos, vive **no consumo** (queries/listagens/atribuição do módulo seguinte), **nunca na criação** de artefatos pelo link público.

## Por que o gate em consumo já funciona

Os 5 pontos canônicos do gate Cadastro→Monitoramento já filtram corretamente por `contratos.aprovado_em IS NOT NULL`:

- `useAtribuicaoManual`, `useServicos`, `useServicosAtribuidos`, `useFilaServicos`
- View `servicos_pendentes_rota` (também recriada na mesma migration `20260526161640_…`)

Ou seja: mesmo que o associado crie `agendamentos_base` no link público, Monitoramento só passa a enxergar quando Cadastro aprovar. O trigger é redundante e incorreto.

## Correção

### Migration

Remover o trigger e a função — só isso. Não mexer na view nem nos hooks.

```sql
DROP TRIGGER IF EXISTS trg_guard_agendamento_base_exige_cadastro_aprovado
  ON public.agendamentos_base;
DROP FUNCTION IF EXISTS public.fn_guard_agendamento_base_exige_cadastro_aprovado();
```

### Atualização de memória

1. Reescrever a Core memory `gate-cadastro-monitoramento-universal`:
   - Remover a menção ao trigger.
   - Deixar explícito: gate vive apenas em quem consome (5 hooks + view).
2. Adicionar Core memory nova (princípio canônico universal):

   > **Link público intocável.** Nenhuma criação de artefato dentro do link público (`agendamentos_base`, `vistorias`, `instalacoes`, `cotacoes_vistoria_fotos`, `contratos_documentos`, pagamento) pode ser bloqueada por estado de módulo posterior. Gates entre módulos vivem **em queries/listagens do módulo seguinte**, nunca em triggers BEFORE INSERT do que o cliente cria. "Fim do link público" é variável por fluxo (agendamento, autovistoria completa, assinatura+pagamento) — Cadastro só passa a ver quando o caminho público canônico daquele fluxo está completo, regra já implementada em `getEtapaPendentePublica` / `useCotacoesLinkPublicoIncompleto`.

## Auditoria complementar (mesma rodada, sem alterações de código)

Antes de implementar, vou varrer os triggers BEFORE INSERT/UPDATE em tabelas que o link público escreve (`agendamentos_base`, `instalacoes`, `vistorias`, `cotacoes_vistoria_fotos`, `contratos_documentos`, `pagamentos`) procurando outros guards que dependam de `contratos.aprovado_em`, `cadastro_aprovado`, ou qualquer campo de módulo posterior. Se houver outros, listo aqui e removo no mesmo migration. Se não houver, registro "nenhum outro encontrado" na memória.

## O que **não** muda

- Filtros operacionais (Cadastro, Monitoramento, Atribuição, Mapa) — já corretos.
- Guards de transição interna (instalação concluída exige rastreador, autovistoria não conclui instalação, etc.) — operam dentro de um único módulo, fora do escopo desta correção.
- Sem retroativo: a cotação travada conclui o agendamento normalmente assim que o trigger sair.

## Validação após implementar

1. Refazer "Confirmar Agendamento" da `COT-20260528-110546183-838` → 200.
2. Conferir que ela passa a aparecer em `/cadastro/propostas-pendentes` (fila normal, com agendamento concluído).
3. Conferir que **não** aparece em nenhuma fila de Monitoramento até o Cadastro aprovar.
4. Spot-check em uma cotação sub-FIPE: autovistoria completa do associado conclui sem nenhum erro de gate (já é o comportamento esperado, só confirma que a varredura da auditoria complementar não pegou nada por engano).

Aprovar para eu implementar.
