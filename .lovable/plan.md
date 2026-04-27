## Relatos a tratar

Excluindo (conforme solicitado):
- `4a0a062a` — forma de pagamento após conclusão do cadastro
- `7fa873f1` — ASSOCIADO NÃO ENCONTRADO

Tratando os 5 abaixo:

| # | ID | Área | Reporter | Descrição |
|---|----|------|----------|-----------|
| 1 | `7b671078` | CADASTRO | Kleytonn | "Está como pendente ainda mas já aceitei 2x" |
| 2 | `88c6d372` | CADASTRO | Kleytonn | Adicionar campo para relatar avaria vista nas fotos/vídeo |
| 3 | `2189c17b` | MONITORAMENTO | Kleytonn | Serviço duplicado no sistema |
| 4 | `51a83208` | MONITORAMENTO | Kaike | Pré-Execução exibindo data 1 dia antes (27/04 → 26/04) |
| 5 | `ee37f6dc` | MONITORAMENTO | Kaike | Após reagendar e atribuir ao Leandro, serviço aparece com data 24 e técnico não recebeu |

---

## Correções

### #1 — Cadastro permanece "pendente" após aprovar 2x (`7b671078`)
**Diagnóstico:** o botão "Aprovar Proposta" dispara `onAprovar` mas o estado da UI não é invalidado/refrescado consistentemente — a proposta vai para `ativo` no banco mas o card do associado/listagem continua mostrando "Pendente" porque a query do dashboard não invalida cache na chamada.

**Ação:**
- Em `PropostaApprovalStepper.tsx` (`onAprovar`) garantir invalidação dos query keys: `['propostas']`, `['associados']`, `['fila-documentos']`, `['cadastro-pendentes']`.
- Adicionar `staleTime: 0` no refetch pós-aprovação e fechar/recarregar o modal apenas após o `mutateAsync` resolver com sucesso.
- Adicionar log de auditoria `proposta_aprovada` para detectar tentativas duplicadas.

### #2 — Campo para relatar avaria no cadastro (`88c6d372`)
**Diagnóstico:** feature nova. No painel de revisão (`PropostaApprovalStepper` / `VistoriaFotosCard`), o analista vê fotos/vídeo mas não tem onde anotar avarias detectadas.

**Ação:**
- Nova coluna `avarias_observadas text` em `propostas` (ou `vistorias_completas` conforme contexto onde a foto vive).
- Em `VistoriaFotosCard.tsx` adicionar `Textarea` "Avarias observadas pelo analista" + botão "Salvar avarias" persistindo no banco.
- Exibir o texto destacado em `PropostaDetalhesTabs` para outros usuários.

### #3 — Serviço duplicado (`2189c17b`)
**Diagnóstico:** apesar do trigger `trg_sync_agendamento_base_on_servico_terminal` (memory `dedupe-agendamentos-rule`), a edge function `reagendar-vistoria-publica` insere um novo serviço sem antes garantir que serviços antigos da mesma origem em status não-terminal estejam fechados. O guard atual só checa idempotência de 60s.

**Ação:**
- Em `supabase/functions/reagendar-vistoria-publica/index.ts`, antes do INSERT do novo serviço, fechar (status `cancelada`) qualquer outro serviço ativo da mesma `cotacao_id` / `instalacao_origem_id` / `vistoria_origem_id` (exceto o próprio que está sendo reagendado).
- Aplicar o mesmo guard nas demais edge functions de criação de serviços derivados.
- Migration de limpeza one-shot: marcar como `cancelada` todos os serviços ativos órfãos (mesma origem) que já tenham um serviço sucessor em status não-terminal.

### #4 — Data 1 dia antes em Pré-Execução (`51a83208`)
**Diagnóstico:** a página `ServicosCampoUnificado` já corrige TZ usando `parseDataLocal`. O bug aparece em **outras telas/componentes** que ainda usam `new Date('YYYY-MM-DD')` (interpretado como UTC, voltando 1 dia em fusos negativos):
- `EncaixeCard.tsx:89` — `new Date(encaixe.data_agendada)`
- `ManutencaoTabela.tsx:156` — `new Date(vistoria.data_agendada)`
- `TratarAusenciaModal.tsx:140` — idem
- `TratarAusenciaRetiradaModal.tsx:211` — idem
- `ManutencaoRastreadoresTab.tsx:229` — idem
- `DetalhesRastreadorDialog.tsx:397` — idem
- `AddInstalacaoDialog.tsx:166` — `parseISO(...)` aplicado em DATE puro
- `TimelineEventoTab.tsx:208` — idem
- `AcompanhamentoProposta.tsx:1129` — idem

**Ação:** trocar todas essas chamadas por `parseDataLocal(...)` (já existente em `src/lib/date-utils.ts`). Atualizar componentes para usar a função utilitária centralizada.

### #5 — Reagendamento aparece com data antiga e técnico não recebe (`ee37f6dc`)
**Diagnóstico (raiz dupla):**
1. O serviço novo é criado em `reagendar-vistoria-publica` mas o `agendamento_base` antigo não é fechado em alguns casos, fazendo o serviço "reagendado" continuar visível com a data antiga (24/04).
2. Quando o monitoramento atribui o novo serviço ao técnico Leandro, a UI do técnico (`TarefaAtualCard` / instalador) lista por `agendamento_base.data_agendada` que aponta ao registro antigo — o técnico vê item "fantasma" e não vê o real.

**Ação:**
- Estender o fix de #3 para fechar `agendamentos_base` antigos vinculados ao serviço reagendado (chamar mesma lógica do trigger `trg_sync_agendamento_base_on_servico_terminal` manualmente após marcar o serviço antigo como `reagendada`).
- Migration one-shot: localizar todos os serviços `reagendada` cujo `agendamento_base` ainda esteja ativo e fechar os agendamentos órfãos.
- Adicionar coluna `data_agendada_atual` view ou ajustar query do instalador para sempre buscar o serviço sucessor mais recente (não o original).

---

## Auditoria
Após aplicar correções, marcar os 5 relatos como `concluido` com `observacao_diretor` descrevendo a correção. Usuários poderão validar via "Testar correções" e, se necessário, reabrir como retratamento.

## Arquivos previstos
- `supabase/functions/reagendar-vistoria-publica/index.ts` (edit)
- `supabase/migrations/<novo>.sql` (cleanup serviços+agendamentos órfãos; coluna `avarias_observadas`)
- `src/components/cadastro/proposta/PropostaApprovalStepper.tsx` (invalidação)
- `src/components/cadastro/VistoriaFotosCard.tsx` (campo avarias)
- `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx` (exibir avarias)
- `src/components/vistoriador/EncaixeCard.tsx` (parseDataLocal)
- `src/components/monitoramento/manutencao/ManutencaoTabela.tsx` (parseDataLocal)
- `src/components/monitoramento/manutencao/TratarAusenciaModal.tsx` (parseDataLocal)
- `src/components/monitoramento/retirada/TratarAusenciaRetiradaModal.tsx` (parseDataLocal)
- `src/components/monitoramento/manutencao-rastreadores/ManutencaoRastreadoresTab.tsx` (parseDataLocal)
- `src/components/monitoramento/estoque/DetalhesRastreadorDialog.tsx` (parseDataLocal)
- `src/components/rotas/AddInstalacaoDialog.tsx` (parseDataLocal)
- `src/components/sinistros/TimelineEventoTab.tsx` (parseDataLocal)
- `src/pages/public/AcompanhamentoProposta.tsx` (parseDataLocal)
