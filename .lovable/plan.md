## Problema

No Monitoramento → **Serviços de Campo** (modal `ServicoDetailModal`) o time não consegue:

1. **Realocar** serviços que não são "instalação" — Retiradas (`vistoria_retirada`), Vistorias de saída/sinistro/periódica, etc. ficam sem botão.
2. **Cancelar** o serviço pelo modal.
3. **Devolver ao Cadastro** em caso de erro (analista quer mandar o caso de volta para revisão de docs / decisão de R&F).

Hoje o botão "Realocar" em `src/components/servicos-campo/ServicoDetailModal.tsx:186` só aparece quando `isInstalacao` (`instalacao | vistoria_entrada | revistoria`). E não existem botões de Cancelar nem Devolver ao Cadastro. O hook `useDevolverAoCadastro` e a edge `devolver-ao-cadastro` já existem; o RPC `realocar_servico` também (memória `mem://logic/operations/realocar-servico-reabertura`). Falta plumbing de UI.

## Mudanças (apenas frontend, escopo UI)

### 1. `ServicoDetailModal.tsx` — barra de ações

Substituir o bloco atual de "Realocar" (linhas 186-199) por um conjunto de ações que cobre **todos os tipos** de serviço atribuíveis (instalação, retirada, vistoria_entrada, vistoria_saida, vistoria, revistoria, manutencao):

- **Realocar** — visível quando `status ∈ {agendada, pendente, nao_compareceu, reagendada, cancelada, em_analise, imprevisto_pendente}` e o serviço tem `instalacao_origem_id` OU `vistoria_origem_id` OU é Retirada. Texto muda para "Reabrir e reagendar" quando `status='cancelada'` (mantém comportamento atual).
- **Cancelar serviço** — visível quando `status ∈ {agendada, pendente, reagendada, nao_compareceu, em_analise}`. Abre `CancelarServicoDialog` (novo componente leve com textarea de motivo) → `update servicos set status='cancelada', motivo_cancelamento=...`.
- **Devolver ao Cadastro** — visível quando o serviço tem `contrato_id` e `status ≠ concluida/aprovada/reprovada`. Abre `DevolverAoCadastroDialog` (novo, com motivo) → chama `useDevolverAoCadastro({ contrato_id, motivo })`.

Permissões: usar `usePermissions()` — exibir Cancelar/Devolver só para `isMonitoramento || isCoordenadorMonitoramento || isDiretor`. Realocar segue a regra atual.

### 2. `RealocarInstalacaoDialog` → suportar Retirada/Vistoria

O dialog hoje recebe apenas `instalacaoId` e atualiza `instalacoes`. Estender props para:

```ts
type RealocarTarget =
  | { kind: 'instalacao'; instalacaoId: string }
  | { kind: 'servico'; servicoId: string; tipo: string }; // retirada, vistoria_*
```

Quando `kind='servico'`, em vez de chamar `useRealocarInstalacao` (que mexe em `instalacoes`/`agendamentos_base`), chamar o RPC genérico `realocar_servico` (já existe no schema). Para Retirada não fazem sentido as abas Base/Rota da mesma forma — habilitar só "Data + período + técnico" (re-attribute). Manter aba Base/Rota apenas quando `kind='instalacao'` ou `tipo ∈ {vistoria_entrada, revistoria}`.

Renomear arquivo/export para `RealocarServicoDialog` (manter re-export do nome antigo para não quebrar `InstalacaoDetailDrawer` e `MapaVistoriasContent`).

### 3. Novos componentes

- `src/components/servicos-campo/CancelarServicoDialog.tsx` — dialog simples com Textarea de motivo, botão "Cancelar serviço" que faz `update servicos` + `agendamentos_base` (quando houver origem), invalida queries `['servicos-campo-unificado', 'fila-servicos']`.
- `src/components/servicos-campo/DevolverAoCadastroDialog.tsx` — wrapper sobre `useDevolverAoCadastro` com textarea de motivo e alerta explicando o efeito (reverte `cadastro_aprovado`, reabre cotação na fila do Cadastro).

### 4. Testes manuais (caminhos)

1. Abrir o serviço RET-2026-00005 (LRP3J98, Retirada agendada) → ver 3 botões → "Realocar" abre dialog com data/técnico (sem Base/Rota) → confirma → status volta a `agendada` com nova data/técnico.
2. Mesmo modal → "Cancelar serviço" → motivo obrigatório → vira `cancelada`, some da fila do técnico.
3. Vistoria com contrato aprovado → "Devolver ao Cadastro" → cotação aparece em `aguardando_aprovacao_cadastro`.
4. Instalação normal — fluxo atual de Realocar (abas Base / Rota / Encaixe) **não regride**.

## Fora de escopo

- Backend: `devolver-ao-cadastro` e RPC `realocar_servico` já existem, não serão alterados.
- Mudar a fila de Atribuição Manual (drag-and-drop) — o usuário usa o modal da fila de Serviços de Campo; o menu da AtribuicaoManualTab já permite reatribuir/devolver e fica intacto.
- Cron, triggers DB, migrações.
