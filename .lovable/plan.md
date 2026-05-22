## Correção de escopo
A versão anterior colocou "Tratar como Manutenção" na tela **Aprovação de Associados** (`AprovacaoInstalacaoDetalhe.tsx`). Isso quebra a regra canônica: aquela fila só decide aprovação/reprovação após o caminho completo do cliente, não converte tipo de serviço.

A ação correta vive em **Monitoramento › Serviços de Campo › Serviços**, como ação **opcional** do operador sobre um serviço pendente, no mesmo padrão de `DevolverAoCadastroDialog` que já existe no `ServicoDetailModal`.

## O que muda em relação à implementação atual

### Remover de Aprovação de Associados
- Em `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx`:
  - Remover o botão "Tratar como Manutenção" e o `MarcarManutencaoDialog` montado ali.
  - Não tocar em nenhuma outra regra dessa tela.

### Adicionar em Serviços de Campo › Serviços
- Em `src/components/servicos-campo/ServicoDetailModal.tsx`:
  - Adicionar um botão **"Tratar como Manutenção"** (ícone `Wrench`, estilo outline/secundário) ao lado das ações já existentes (`DevolverAoCadastroDialog`, `RealocarServicoSimplesDialog`, `CancelarServicoDialog`).
  - O botão só aparece quando o serviço atual é `instalacao` ou `vistoria_entrada` e ainda está em estado não terminal (mesmas regras que já valem para realocar).
  - Reaproveita o `MarcarManutencaoDialog` já criado para abrir a busca tri-fonte e converter o serviço.
- Opcional: expor o mesmo botão na linha da `ServicosTable` apenas se ficar visualmente leve; por padrão fica só dentro do modal de detalhe.

### Hook de conversão (sem mudar comportamento)
- `useConverterParaManutencao.ts` continua igual:
  - Mantém `origem='monitoramento_aprovacao'`? Não — renomear para `origem='servicos_campo_manual'` para refletir a tela correta.
  - Continua cancelando o serviço original (`instalacao` / `vistoria_entrada`) e criando um `vistoria_manutencao` novo herdando contexto (`veiculo_id`, `contrato_id`, `associado_id`, endereço).
  - Continua respeitando "1 serviço vivo por origem".
  - Continua gravando `intencao_rastreador_imei` e `intencao_rastreador_rastreador_id` quando o operador informou IMEI/rastreador.

### Banco
- Migration `20260522154822_..._add_intencao_rastreador.sql` permanece como está — colunas continuam válidas.
- Sem novas migrations.

### Regras canônicas preservadas
- Aprovação de Associados continua decidindo só aprovar/reprovar/devolver — não converte tipo.
- `cadastro_aprovado` não é alterado pela conversão.
- Badge indigo de `vistoria_manutencao` continua vindo de `ServicoTipoBadge`.
- Guards DB (`trg_guard_instalacao_concluida_exige_rastreador`, `trg_guard_veiculo_ativo_exige_rastreador`) seguem ativos e não são afetados.
- Triggers de dedupe `trg_sync_agendamento_base_on_servico_terminal` fecham automaticamente o agendamento do serviço original cancelado.

### Memória
- Atualizar `mem://logic/operations/intencao-rastreador-fallback-monitoramento.md`:
  - Trocar referência de "Aprovação de Associados" por "Serviços de Campo › Serviços (ação opcional no `ServicoDetailModal`)".
  - Trocar `origem='monitoramento_aprovacao'` por `origem='servicos_campo_manual'`.
  - Manter regras de bloqueio (IMEI em outro veículo ativo), preservação de `cadastro_aprovado` e badge canônico.
- Atualizar o item do índice `mem://index.md` para apontar a nova localização.

## Detalhes técnicos
- Arquivos editados:
  - `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx` — remover botão e dialog.
  - `src/components/servicos-campo/ServicoDetailModal.tsx` — adicionar botão "Tratar como Manutenção" + mount do `MarcarManutencaoDialog`.
  - `src/hooks/useConverterParaManutencao.ts` — trocar `origem` para `servicos_campo_manual`.
  - `mem://logic/operations/intencao-rastreador-fallback-monitoramento.md` — corrigir localização e origem.
  - `mem://index.md` — atualizar one-liner do item.
- Arquivos mantidos sem alteração:
  - `src/components/monitoramento/MarcarManutencaoDialog.tsx`
  - migration `..._add_intencao_rastreador.sql`

## Fora de escopo
- Nenhuma alteração em fluxo SGA Hinova, modelo/listar ou Advanced Especial (esses pontos ficam para tarefas separadas).
- Nenhuma mudança em Aprovação de Associados além de remover o botão indevido.