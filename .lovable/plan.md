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

## Fase 4 — Interpretação enriquecida do orçamento (em andamento)

### Fase 4.1 — Extração enriquecida (✅ entregue)
- `extract-orcamento-pdf` migrado para **Gemini 2.5 Pro** com schema enriquecido:
  - `header`: placa, chassi, marca/modelo/ano/cor, KM, FIPE, oficina (nome/CNPJ/cidade-UF), nº/data do orçamento, tipo de sinistro.
  - `impact_areas`: lista de regiões de impacto (Cilia/Audatex) com qtd de peças.
  - `pecas`: agora com `operacao` (T/R&I/REP/PIN), `area_impacto`, `horas_funilaria/pintura/reparo`, `valor_mao_obra` (MO vinculada à peça pai), `origem` e `flags` (`sem_amparo`, `inclusao_manual`).
  - `servicos`: somente serviços avulsos (não duplica MO já vinculada à peça).
  - `orcamento_hash` (SHA-256 do PDF) retornado para idempotência.
- Conversão base64 em chunks (evita stack overflow em PDFs grandes).
- Tipos do client (`OrcamentoPDFImport.tsx`) atualizados.

### Próximas etapas
- 4.2 Migração: colunas `area_impacto`, `horas`, `operacao`, `flags`, `peca_pai_id` em `ordens_servico_itens`; `dados_orcamento` JSONB + `orcamento_hash` UNIQUE em `vistorias_evento`.
- 4.3 `OrcamentoReviewModal.tsx` — confronto header PDF × sistema, revisão por área de impacto.
- 4.4 Persistência em `VistoriaEventoOrcamento.tsx` usando `peca_pai_id` para vincular MO à peça.
- 4.5 Atualizar `vw_custo_evento_por_cobertura` para somar MO vinculada na cobertura da peça pai.

### Fase 4.2 — Schema enriquecido (✅ entregue)
- `ordens_servico_itens`: `area_impacto`, `operacao` (T/R&I/REP/PIN), `horas`, `flags[]`, `peca_pai_id` (FK auto-relacional). Índices em `peca_pai_id` e `area_impacto`.
- `vistorias_evento`: `dados_orcamento` (JSONB com header/impact_areas) e `orcamento_hash` + UNIQUE `(id, orcamento_hash)`.

### Fase 4.4 — Persistência vinculada (✅ entregue)
- `VistoriaEventoOrcamento`:
  - Mantém `dados_orcamento` bruto (header, impact_areas, hash) e envia ao salvar.
  - Converte cada peça do PDF em 1 linha `peca` + N linhas `servico` (Funilaria/Pintura/Reparo) com `peca_pai_idx` e `horas`, distribuindo `valor_mao_obra` proporcionalmente às horas.
  - `ItemParecer` ganhou `operacao`, `area_impacto`, `horas`, `flags`, `peca_pai_idx`.
- `salvar-vistoria-regulador`: grava `dados_orcamento` e `orcamento_hash` na vistoria.
- `gerar-os-cotacao-aprovada`:
  - Insere peças primeiro, captura ids e resolve `peca_pai_id` das linhas de MO/serviço via `peca_pai_idx` → descrição → id.
  - Propaga `operacao`, `area_impacto`, `horas`, `flags` em todos os itens.
  - Peças herdam `operacao/area_impacto/flags` da peça correspondente do orçamento original.

### Fase 4.5 — Custo por cobertura com herança de MO (✅ entregue)
- `vw_custo_evento_por_cobertura` agora resolve `cobertura_id` de itens de MO/serviço via `peca_pai_id` quando o item filho não tem cobertura própria, somando funilaria/pintura/reparo na mesma cobertura da peça pai.

### Fase 4.3 — Modal de revisão (✅ entregue)
- Novo `OrcamentoReviewModal` exibido entre o upload e a importação dos itens. Mostra Placa/Chassi/Marca/Modelo/Ano do PDF × Sistema com badges de confere/divergente, dados de oficina, áreas de impacto e resumo. Só aplica os itens em `VistoriaEventoOrcamento` após confirmação.

### Fase 4 — concluída
Todas as etapas (4.1 extração enriquecida, 4.2 schema, 4.3 modal de revisão, 4.4 persistência vinculada, 4.5 view de custo) foram entregues.
