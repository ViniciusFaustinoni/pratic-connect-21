# Alinhamento Completo do Fluxo de Eventos

## Status

- ✅ **Fase 1** concluída — carência por cobertura, lembretes de coparticipação, OS pós-pagamento.
- ✅ **Fase 2** concluída — executor unificado e PDF+IA obrigatório.
- ✅ **Fase 3** concluída — aprovação complementar de itens e custo por cobertura.

## Fase 3 — entregue

1. **Schema**:
   - `ordens_servico_itens`: `cobertura_id`, `complementar`, `status_aprovacao` (`pendente|aprovado|rejeitado`), `aprovado_por`, `aprovado_em`, `motivo_rejeicao`, `descoberto_em`, `observacao`.
   - `evento_cotacoes_pecas`: `cobertura_id`.
   - `contas_pagar`: `cobertura_id`, `sinistro_id`.
   - Trigger `fn_set_cobertura_from_sinistro` preenche `cobertura_id` automaticamente a partir do tipo do sinistro.
   - View `vw_custo_evento_por_cobertura` agrega peças/OS, cotações aprovadas e contas a pagar por cobertura.

2. **Aprovação complementar**:
   - `OSItemFormDialog` e `AdicionarItemOSModal` aceitam `complementar` — quando OS está em execução, o item entra como `pendente` e fica destacado em âmbar na tabela.
   - Hook `useItensComplementaresPendentes` + `useDecidirItemComplementar` expõem fila e ação do analista.
   - Componente `AprovacaoComplementarPanel` renderizado no detalhe do evento (`SinistroDetalhe`) — botões Aprovar/Rejeitar (com motivo) liberados para Analista de Eventos e Diretor.

3. **Custo por cobertura**:
   - Componente `CustoEventoPorCobertura` renderizado abaixo das coberturas/benefícios utilizados, mostrando peças/OS, cotações, contas a pagar e total por cobertura.

## Fase 2 — entregue

1. **Schema** (`vistorias_evento`):
   - `executor_tipo` (`regulador` | `tecnico_interno` | `prestador_externo`)
   - `executor_id` (uuid do user/profissional)
   - Backfill: registros antigos com `regulador_id` viram `executor_tipo='regulador'`.

2. **Atribuição unificada no Monitoramento**:
   - `AtribuirVistoriadorModal` ganhou seletor "Tipo de executor" quando `isVistoriaEvento=true`.
   - Lista de profissionais filtra por role conforme o tipo (`regulador` / `instalador*|vistoriador*` / `prestador_externo`).
   - `FilaVistorias.handleSaveAtribuicao` grava em `vistorias_evento` (e mantém `regulador_id` em sync quando o tipo é Regulador), preservando o caminho legado para vistorias tradicionais e serviços de campo.

3. **Componente compartilhado**:
   - `src/components/vistoria-evento/index.ts` reexporta os componentes do regulador como fonte canônica para os 3 perfis.
   - `ExecutarVistoriaEvento` agora detecta a rota e usa back URL contextual.
   - Nova rota neutra `/vistoria-evento/:id` para técnicos internos e prestadores externos atribuídos.
   - `VistoriaEventoOrcamento` removeu botões "+ Peça / + Serviço" — itens só entram via PDF+IA (`OrcamentoPDFImport`), com edição posterior de quantidades/valores. Mensagem explicativa quando lista vazia.

## Fase 3 — pendente

6. **Aprovação complementar**: novo status `aguardando_aprovacao_complementar` em `ordens_servico_itens`, fluxo de aprovação pelo analista, lançamento financeiro adicional após aprovação.
7. **Custo por cobertura**: adicionar `cobertura_id` em `contas_pagar`, `evento_cotacoes_pecas`, `ordens_servico_itens`; backfill via `TIPO_SINISTRO_TO_COBERTURA`; view `vw_custo_evento_por_cobertura`; nova aba "Custo por cobertura" no detalhe do evento + relatório agregado em `SinistrosDashboard`.
