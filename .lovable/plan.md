## Objetivo

Estender o **modo embedado** (modal full-screen) do `RealizarVistoriaInternaButton` para os 2 serviços materializados pelo novo fluxo de Retirada, para que o Coordenador de Monitoramento conclua tudo dentro do `ServicoDetailModal` sem abrir nova aba.

Hoje só `instalacao` / `vistoria_entrada` / `revistoria` (rota `/instalador/instalacao`) rodam embedados no `VistoriaInternaDialog`. Os demais tipos (`vistoria_retirada`, `vistoria_manutencao`, etc.) continuam abrindo `window.open`.

## Escopo

Apenas frontend/presentation. Sem migração, sem edge, sem mudança no fluxo do técnico.

### Tela

- `src/components/servicos-campo/ServicoDetailModal.tsx` — o botão "Realizar Vistoria Interna" já está renderizado lá; nenhuma mudança estrutural.

## Mudanças

### 1. `RealizarVistoriaInternaButton.tsx`
- Ampliar `podeEmbedar` para cobrir também:
  - `retirada_rastreador` (novo tipo materializado pela Retirada).
  - `vistoria_retirada` (vistoria acompanhante quando a escolha foi "Retirada").
  - `vistoria_entrada` com `modalidade ∈ {'enxuta_pos_retirada', 'completa_pos_retirada'}` (já cai no caminho embedado existente — só validar o resolver de rota).
- Ajustar `resolverRotaTecnico`:
  - `retirada_rastreador` → `/instalador/retirada` (hoje só `vistoria_retirada` mapeia).
  - Mantém `vistoria_retirada` → `/instalador/retirada`.
- Receber `servico.modalidade` no objeto `Servico` que o botão já consome (campo já existe no select do `useServicos`/`ServicoDetailModal`; só conferir).

### 2. `VistoriaInternaDialog.tsx`
- Substituir o hard-code de `InstaladorChecklist` por um resolver baseado no `tipo` do serviço:
  - `instalacao` / `vistoria_entrada` / `revistoria` → `InstaladorChecklist` (atual).
  - `retirada_rastreador` / `vistoria_retirada` → página de retirada do instalador (`InstaladorRetirada` — confirmar nome exato em `src/pages/instalador/`).
- Manter o mesmo padrão: prop `servicoIdProp`, flag `vistoriaInterna`, `onClose` que invalida as queries.
- Se a página de retirada hoje não aceitar `servicoIdProp` / `vistoriaInterna` / `onClose`, adicionar essas props (mesma assinatura do `InstaladorChecklist`) sem alterar lógica de conclusão.

### 3. Invalidação de queries no `onClose`
- Acrescentar ao `handleClose` do `VistoriaInternaDialog`:
  - `['rastreadores']`, `['rastreador-detalhe']` (para o vínculo zerar na UI após retirada).
  - `['servico-detalhe-aprovacao']` (já existe via outras telas).

## Fora de escopo

- Não toca `AprovacaoInstalacaoDetalhe` nem `ModalDetalhesTroca` (usuário optou por restringir ao `ServicoDetailModal`).
- Não altera o app do técnico (`InstaladorRetirada` / `InstaladorChecklist`) além de aceitar as 3 props do modo embedado, se ainda não aceita.
- Não altera `useConverterParaRetirada`, edges, triggers, regras canônicas (1 serviço vivo por origem, guards de cadastro, etc.).
- Nenhum item da `<memory/index>` é alterado.

## Verificação pós-implementação

1. Em `ServicoDetailModal` aberto sobre um `retirada_rastreador`, clicar "Realizar Vistoria Interna" abre o `VistoriaInternaDialog` (não nova aba).
2. Mesmo teste com `vistoria_retirada` e com `vistoria_entrada` modalidade `enxuta_pos_retirada` / `completa_pos_retirada`.
3. Concluir pelo modal fecha o dialog, invalida queries e o serviço some/atualiza na lista.
4. Tipos antigos (`instalacao`, `vistoria_manutencao` etc.) seguem com o comportamento atual.

## Arquivos editados

- `src/components/servicos-campo/RealizarVistoriaInternaButton.tsx`
- `src/components/monitoramento/VistoriaInternaDialog.tsx`
- (Se necessário) `src/pages/instalador/InstaladorRetirada.tsx` — apenas para aceitar `servicoIdProp` / `vistoriaInterna` / `onClose`, espelhando `InstaladorChecklist`.
