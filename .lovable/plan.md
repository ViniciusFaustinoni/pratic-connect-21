

# Auditoria: Mapeamento do que existe para o Fluxo de Retirada de Rastreador

---

## 1. CANCELAMENTO

**✅ Existe — Tela de cancelamento completa**
- `src/components/cadastro/CancelarAssociadoDialog.tsx` (500 linhas) — Modal acessado na tela de detalhe do associado (`AssociadoDetalhe.tsx`). Coleta motivo (select com 8 opções), observações, exibe financeiro pendente e executa o cancelamento.
- Motivos incluem: solicitação do associado, insatisfação, concorrente, **venda do veículo**, dificuldade financeira, mudança de cidade, falecimento, outro.

**✅ Existe — Enum `status_associado`** inclui: `cancelado`, `suspenso`, `inadimplente`, `bloqueado`

**✅ Existe — Colunas no associado**: `data_cancelamento`, `motivo_cancelamento`, `tipo_saida` (ex: `inadimplencia`), `pode_reativar`, `data_bloqueio`

**✅ Existe — Exclusão por diretoria**: `src/components/cadastro/ExcluirAssociadoDialog.tsx` — chama `processar-pos-retirada` com motivo específico

**✅ Existe — Cancelamento via chatbot**: O assistente IA (`assistente-chat/index.ts`) aceita pedidos de cancelamento do associado e cria solicitação em `chat_solicitacoes_ia` com `tipo = 'cancelamento'`

---

## 2. RETIRADA DE RASTREADOR

**✅ Existe — Fluxo completo implementado**

| Artefato | Descrição |
|---|---|
| Enum `tipo_servico` valor `vistoria_retirada` | Migration `20260206120322` |
| Enum `status_rastreador` valor `retirada_pendente` | Migration `20260209022628` |
| Colunas em `servicos` | `motivo_retirada`, `sub_tipo_retirada`, `cancelamento_bloqueado_ate_devolucao`, `solicitado_por_modulo`, `tem_debitos_pendentes`, `integridade_aparelho`, `obs_integridade`, `multa_aplicada`, `multa_valor`, `checklist_retirada` |
| `src/types/retirada.ts` | Tipos: `MotivoRetirada` (5 valores), `SubTipoRetirada`, `IntegridadeAparelho`, `FormaCobrancaMulta`, `MotivoMulta`, `ChecklistRetirada` |
| `src/hooks/useRetiradaRastreador.ts` (330 linhas) | Mutations: criar solicitação, agendar retirada, listar retiradas |
| `src/hooks/useCriarRetirada.ts` | Criar serviço de retirada a partir do rastreador |
| `src/hooks/useMultaRetirada.ts` | Gestão de multa R$ 400 por não devolução |
| `src/pages/monitoramento/RetiradasPage.tsx` | Tela completa de gestão de retiradas (filtros, tabela, ações) |
| `src/pages/monitoramento/RetiradasContent.tsx` | Versão embutível como aba |
| `src/pages/instalador/ExecutarRetirada.tsx` | Tela do técnico para executar a retirada em campo |
| `src/components/monitoramento/retirada/AgendarRetiradaModal.tsx` | Modal de agendamento |
| `src/components/monitoramento/retirada/TratarAusenciaRetiradaModal.tsx` | Modal para não comparecimento |
| `src/components/monitoramento/retirada/AplicarMultaModal.tsx` | Modal de multa |

**✅ Existe — Aba "Retiradas" em Serviços de Campo**
- A página `VistoriasInstalacoesMon.tsx` já contém aba de Retiradas usando `RetiradasContent`

**✅ Existe — Edge Functions**

| Function | Descrição |
|---|---|
| `concluir-retirada` (459 linhas) | Conclui serviço, desvincula rastreador, atualiza status, chama pós-retirada |
| `processar-pos-retirada` (370 linhas) | Cancela associado, inativa veículos, integra Rede Veículos |
| `gerar-link-retirada` | Gera link para associado confirmar retirada |
| `confirmar-retirada` | Confirma retirada via link do associado (OS em oficina) |
| `notificar-retirada-whatsapp` | Envia WhatsApp de agendamento de retirada |

---

## 3. INADIMPLENCIA E COMUNICACAO AUTOMATICA

**✅ Existe — Automações de inadimplência**

| Artefato | Descrição |
|---|---|
| `cron-suspender-inadimplentes` (269 linhas) | Suspende associados com cobranças vencidas (carência configurável). Integra com Rede Veículos para informar inadimplência |
| `cron-excluir-inadimplentes-120` (131 linhas) | Cancela associados suspensos há 120+ dias. Seta `tipo_saida = 'inadimplencia'`, `motivo_cancelamento` automático |
| `gerar-fila-cobranca` (edge function) | Verifica inadimplentes sem contato recente (15+ dias) |
| `executar-regua-cobranca` | Executa régua de cobrança |

**✅ Existe — Logs de comunicação**
- `sinistro_contatos_agendados` — agendamentos de mensagens automáticas (usado em `gerar-link-retirada` para lembretes)
- Integração WhatsApp completa: `whatsapp-send-text`, `whatsapp-send-media`, etc.
- `chatwoot-webhook` para registro de conversas

**✅ Existe — Contagem de inadimplência**
- `InadimplenciaIdadeChart` no dashboard financeiro
- `AssociadoSituacaoCard` com `STATUS_INADIMPLENCIA_CONFIG` (adimplente, regularização simples, etc.)
- Lógica de cobertura suspensa por veículo inadimplente (`veiculosInadimplentes`)

**⚠️ Existe parcialmente — "dias_inadimplente"**
- Não existe coluna específica `dias_inadimplente` persistida. A contagem é calculada em runtime a partir de `data_bloqueio` e datas de cobranças vencidas (`asaas_cobrancas`).

---

## 4. AGENDAMENTO E ENCAIXE

**✅ Existe — Enum `tipo_servico` completo**

Valores: `instalacao`, `vistoria_entrada`, `vistoria_saida`, `vistoria_sinistro`, `vistoria_periodica`, `vistoria_manutencao`, `vistoria_retirada`

**✅ Existe — Fluxo de encaixe**
- Edge function `processar-encaixes-automaticos`
- Edge function `solicitar-encaixe`
- Tabela `servicos` com campos: `permite_encaixe`, `encaixe_id`, `data_agendada`, `periodo`, `profissional_id`, `rota_id`
- Enum `status_servico`: pendente, agendada, em_rota, em_andamento, concluida, reagendada, cancelada, etc.

**✅ Existe — Coluna de origem**: `solicitado_por_modulo` na tabela `servicos` (valores: 'cadastro', etc.)
**✅ Existe — Coluna de motivo**: `motivo_retirada` na tabela `servicos` distingue: cancelamento_voluntario, inadimplencia, exclusao_diretoria, substituicao_veiculo, busca_apreensao

---

## 5. SUBSTITUICAO DE VEICULO

**✅ Existe — Fluxo completo**
- Tabela `substituicoes_veiculo` com campos: `associado_id`, `veiculo_antigo_id`, `veiculo_novo_id`, `veiculo_antigo_placa`, `veiculo_novo_placa`, `taxa_substituicao`, `status`, etc.
- Status da substituição: `aguardando_aprovacao`, `aprovada`, `aguardando_retirada`, `aguardando_vistoria`, `efetivada`, `rejeitada`
- `src/hooks/useSubstituicaoVeiculo.ts` — CRUD completo
- `src/components/substituicao/StepRastreador.tsx` — verifica existência de retirada e cria serviço `vistoria_retirada` vinculado
- `supabase/functions/efetivar-substituicao/index.ts` — efetiva a troca após conclusão de todas as etapas
- O `concluir-retirada` verifica se o motivo é `substituicao_veiculo` e avança a substituição para `aguardando_vistoria`

**✅ Existe — Verificação de rastreador no veículo sendo substituído**: `StepRastreador.tsx` consulta rastreador instalado e cria retirada se necessário

**✅ Existe — Status `aguardando_retirada`**: A substituição fica nesse status até a retirada ser concluída

---

## 6. VENDA DE VEICULO (CANCELAMENTO POR VENDA)

**✅ Existe** — O `CancelarAssociadoDialog` inclui motivo `venda_veiculo` com label "Venda do veículo (sem substituição)"

**❌ Não existe** — Fluxo diferenciado para cancelamento por venda. Usa o mesmo fluxo genérico de cancelamento.

---

## TABELAS E COLUNAS RELEVANTES PARA RETIRADA

```text
servicos
├── id (uuid, PK)
├── tipo (enum tipo_servico) — 'vistoria_retirada'
├── status (enum status_servico)
├── protocolo (text, gerado automaticamente — prefixo RET)
├── associado_id (uuid, FK)
├── veiculo_id (uuid, FK)
├── rastreador_id (uuid, FK)
├── profissional_id (uuid, FK)
├── data_agendada (date)
├── periodo (enum periodo_servico)
├── rota_id (uuid, FK)
├── motivo_retirada (text) — cancelamento_voluntario|inadimplencia|exclusao_diretoria|substituicao_veiculo|busca_apreensao
├── sub_tipo_retirada (text) — somente_retirada|retirada_com_nova_instalacao
├── solicitado_por_modulo (text) — cadastro|monitoramento|financeiro|diretoria
├── cancelamento_bloqueado_ate_devolucao (boolean)
├── tem_debitos_pendentes (boolean)
├── integridade_aparelho (text) — integro|danificado|violado|molhado
├── obs_integridade (text)
├── multa_aplicada (boolean)
├── multa_valor (numeric)
├── checklist_retirada (jsonb)
└── permite_encaixe (boolean)

rastreadores
├── status (enum status_rastreador) — inclui 'retirada_pendente'
├── veiculo_id (uuid, FK)
└── codigo / imei (text)

associados
├── status (enum status_associado) — cancelado|suspenso|inadimplente
├── pendencia_rastreador (boolean)
├── data_cancelamento (timestamptz)
├── motivo_cancelamento (text)
├── tipo_saida (text) — inadimplencia|etc
├── pode_reativar (boolean)
└── data_bloqueio (timestamptz)

substituicoes_veiculo
├── status (text) — aguardando_retirada|aguardando_vistoria|efetivada|...
├── veiculo_antigo_id (uuid)
├── veiculo_novo_id (uuid)
└── associado_id (uuid)
```

## CONCLUSAO

O fluxo de Retirada de Rastreador esta **amplamente implementado** — possui tipos, hooks, telas, edge functions de conclusão, pós-processamento e integração com substituição de veículo. A automação de inadimplência (suspensão e exclusão por cron) também já existe. O que **não existe** é um fluxo diferenciado para venda de veículo (usa o cancelamento genérico).

