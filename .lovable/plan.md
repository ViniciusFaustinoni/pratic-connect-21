

# Orcamento Vivo -- Sistema de Orcamento Dinamico para Reparos

## Resumo

Criar um sistema completo de orcamento dinamico ("Orcamento Vivo") que acompanha a evolucao real dos custos de reparo de veiculos sinistrados. O orcamento nasce com a estimativa da oficina, evolui conforme o regulador descobre novos danos ou economias, e se consolida quando o reparo termina. Toda alteracao fica registrada com trilha de auditoria completa.

---

## Analise do Estado Atual

O sistema ja possui:
- Tabela `ordens_servico` com campos `valor_orcamento`, `valor_aprovado`, `valor_pago`
- Tabela `ordens_servico_itens` com campos: `tipo` (peca/mao_de_obra/servico_terceiro), `descricao`, `quantidade`, `valor_unitario`, `valor_total`, `aprovado`, `marca`, `numero_peca`
- Tabela `sinistros` com campos de orcamento: `orcamento_valor_total`, `orcamento_detalhamento` (JSONB), `orcamento_status`, `orcamento_data`, `valor_fipe`, `percentual_fipe`
- `CardControleReparo` gerencia o fluxo de pecas/reparo
- `SolicitarOrcamentoDialog` envia cotacoes para auto centers
- `ReguladorOficina.tsx` onde o regulador acompanha reparos
- Roles existentes: `regulador`, `analista_eventos`, `diretor`
- Funcao `has_role()` para RLS

**O que falta:** sistema dedicado de itens do orcamento com historico de alteracoes, campos de origem de peca, status granular por item, consolidacao formal, e alerta de perda total (75% FIPE).

---

## Estrutura de Dados

### Nova tabela: `orcamento_reparo`

Tabela principal do orcamento vinculado ao sinistro.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| sinistro_id | uuid FK -> sinistros | Evento vinculado (UNIQUE) |
| oficina_id | uuid FK -> oficinas | Oficina responsavel |
| status | text | 'elaboracao', 'execucao', 'consolidado' |
| valor_inicial_total | numeric(12,2) | Total original (snapshot no 1o save) |
| valor_pecas | numeric(12,2) | Total pecas ativas (calculado) |
| valor_mao_obra | numeric(12,2) | Total mao de obra ativa (calculado) |
| valor_total | numeric(12,2) | Soma geral ativa |
| consolidado_em | timestamptz | Data da consolidacao |
| consolidado_por | uuid FK -> auth.users | Quem consolidou |
| observacao_final | text | Comentario de consolidacao |
| created_at | timestamptz | Criacao |
| updated_at | timestamptz | Ultima atualizacao |

### Nova tabela: `orcamento_reparo_itens`

Cada item (peca ou servico) do orcamento.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| orcamento_id | uuid FK -> orcamento_reparo | Orcamento pai |
| tipo | text | 'peca' ou 'mao_de_obra' |
| descricao | text NOT NULL | Nome da peca/servico |
| origem | text | 'original', 'seminova', 'paralela' (so peca) |
| quantidade | numeric DEFAULT 1 | Quantidade |
| valor_unitario | numeric(12,2) | Preco unitario |
| valor_total | numeric(12,2) | Calculado: qtd x unitario |
| status | text | 'pendente', 'aprovado', 'comprado', 'instalado', 'cancelado' |
| observacao | text | Texto livre |
| motivo_inclusao | text | Obrigatorio se orcamento em execucao |
| motivo_cancelamento | text | Se cancelado |
| created_at | timestamptz | Criacao |
| updated_at | timestamptz | Atualizacao |
| created_by | uuid FK -> auth.users | Quem criou |

### Nova tabela: `orcamento_reparo_historico`

Log de auditoria de todas as alteracoes.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| orcamento_id | uuid FK -> orcamento_reparo | Orcamento |
| item_id | uuid FK -> orcamento_reparo_itens | Item afetado (nullable) |
| acao | text | 'item_adicionado', 'item_editado', 'item_cancelado', 'consolidado' |
| descricao | text | Descricao legivel da alteracao |
| dados_anteriores | jsonb | Snapshot do estado anterior |
| dados_novos | jsonb | Snapshot do estado novo |
| motivo | text | Motivo informado pelo usuario |
| usuario_id | uuid FK -> auth.users | Quem fez |
| created_at | timestamptz | Quando |

### RLS Policies

- **SELECT orcamento_reparo / itens / historico**: `has_role(auth.uid(), 'regulador')` OR `has_role(auth.uid(), 'analista_eventos')` OR `has_role(auth.uid(), 'diretor')`
- **INSERT/UPDATE orcamento_reparo**: `has_role(auth.uid(), 'regulador')` OR `has_role(auth.uid(), 'diretor')`
- **INSERT orcamento_reparo_itens**: `has_role(auth.uid(), 'regulador')` OR `has_role(auth.uid(), 'diretor')`
- **UPDATE orcamento_reparo_itens**: Permitido se orcamento NAO estiver consolidado OU `has_role(auth.uid(), 'diretor')`
- **INSERT orcamento_reparo_historico**: `has_role(auth.uid(), 'regulador')` OR `has_role(auth.uid(), 'analista_eventos')` OR `has_role(auth.uid(), 'diretor')`

---

## Parte 1: Migracao SQL

Arquivo: nova migracao

- Criar tabelas `orcamento_reparo`, `orcamento_reparo_itens`, `orcamento_reparo_historico`
- Indices em `sinistro_id`, `orcamento_id`
- Constraint UNIQUE em `orcamento_reparo.sinistro_id`
- Politicas RLS conforme acima
- Trigger para calcular `valor_total` do item automaticamente (quantidade x valor_unitario)
- Trigger para recalcular totais do orcamento ao inserir/atualizar/deletar itens

---

## Parte 2: Hook React

### Arquivo: `src/hooks/useOrcamentoReparo.ts`

Hooks:
- `useOrcamentoReparo(sinistroId)` -- busca o orcamento do sinistro com contagem de itens
- `useOrcamentoItens(orcamentoId)` -- lista itens separados por tipo (pecas vs mao_de_obra)
- `useOrcamentoHistorico(orcamentoId)` -- lista historico com join em profiles para nome
- `useCriarOrcamento()` -- cria orcamento vinculado ao sinistro
- `useAdicionarItem()` -- insere item + registra historico
- `useEditarItem()` -- atualiza item + registra historico com diff
- `useCancelarItem()` -- marca item como cancelado + registra historico
- `useConsolidarOrcamento()` -- fecha orcamento, atualiza status dos itens, registra historico

Cada mutation de item deve:
1. Fazer a operacao no item
2. Inserir registro no historico com dados anteriores/novos
3. Recalcular totais do orcamento (ou delegar ao trigger SQL)
4. Invalidar queries

---

## Parte 3: Componentes

### `src/components/orcamento/CardOrcamentoReparo.tsx`

Card principal que aparece no SinistroAnalise/SinistroDetalhe. Contem:

- Cabecalho: titulo, badge de status (Elaboracao/Execucao/Consolidado), oficina, data
- 4 mini-cards: Total Pecas, Total Mao de Obra, Total Geral, Variacao
- Valor FIPE discreto com alerta 75%
- Abas: Pecas | Mao de Obra | Historico
- Tabela de itens por aba com acoes (editar/cancelar)
- Rodape com totais
- Botoes: + Adicionar Peca, + Adicionar Servico, Consolidar Orcamento
- Se readonly (analista sem permissao de edicao): botoes ocultos, so visualizacao

### `src/components/orcamento/AdicionarItemModal.tsx`

Modal para adicionar ou editar um item:
- Radio tipo (peca/mao de obra)
- Descricao, Origem (so peca), Quantidade, Valor Unitario
- Calculo automatico do total
- Status (pendente/aprovado/comprado/instalado/cancelado)
- Observacao
- Motivo da inclusao (obrigatorio se orcamento em execucao)
- Ao editar: campo "O que mudou" obrigatorio

### `src/components/orcamento/CancelarItemDialog.tsx`

Dialog de confirmacao com campo obrigatorio "Motivo do cancelamento".

### `src/components/orcamento/ConsolidarOrcamentoModal.tsx`

Modal de consolidacao com:
- Resumo visual: pecas, mao de obra, total, variacao, % FIPE
- Textarea observacao final
- Checkbox de confirmacao
- Alerta se > 75% FIPE (bloqueia consolidacao ate decisao)
- Ao confirmar: marca consolidado, atualiza itens pendentes para instalado

### `src/components/orcamento/HistoricoAlteracoes.tsx`

Lista cronologica com icones por acao, nome do usuario, data/hora, descricao da alteracao e motivo.

---

## Parte 4: Integracao no SinistroAnalise

### Arquivo: `src/pages/eventos/SinistroAnalise.tsx`

Na fase de reparo (`em_reparo`, `pecas_em_cotacao`, `aprovado`), adicionar o `CardOrcamentoReparo` na coluna principal, abaixo do `CardControleReparo`. 

Para o analista de eventos: visualizacao completa mas sem botoes de edicao de itens. Pode ver historico e totais. Botao "Aprovar Orcamento" se status = elaboracao.

### Arquivo: `src/pages/eventos/SinistroDetalhe.tsx`

Mesmo card na tela de detalhe (mais simples, ja tem CardControleReparo).

---

## Parte 5: Integracao no ReguladorOficina

### Arquivo: `src/pages/regulador/ReguladorOficina.tsx`

Na listagem de veiculos em oficina, ao expandir um veiculo, mostrar:
- Resumo do orcamento (total, variacao, status)
- Botao "Gerenciar Orcamento" que abre o card completo em modal ou navega para tela dedicada

---

## Parte 6: Alerta de Perda Total (75% FIPE)

Logica no `CardOrcamentoReparo`:
- Ao recalcular totais, comparar `valor_total` com `valor_fipe * 0.75`
- Se ultrapassar: badge vermelho, mensagem de alerta
- Bloquear consolidacao ate que analista/diretor tome decisao
- Notificacao automatica (insert em tabela de notificacoes existente)

---

## Parte 7: Criacao Automatica do Orcamento

Quando o evento entra em fase de reparo (status `em_reparo` ou quando a cotacao e aprovada), o sistema cria automaticamente o `orcamento_reparo` com:
- Itens vindos da cotacao aprovada (pecas com precos)
- Itens de mao de obra vindos do orcamento do regulador (`vistoria.itens_orcamento`)
- Status inicial: 'elaboracao'
- `valor_inicial_total` = soma de todos os itens

Isso pode ser feito no frontend (ao aprovar cotacao ou ao mudar status para em_reparo) ou via trigger SQL.

---

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| Nova migracao SQL | Tabelas, RLS, triggers |
| `src/hooks/useOrcamentoReparo.ts` | Novo hook CRUD completo |
| `src/components/orcamento/CardOrcamentoReparo.tsx` | Novo card principal |
| `src/components/orcamento/AdicionarItemModal.tsx` | Novo modal adicionar/editar |
| `src/components/orcamento/CancelarItemDialog.tsx` | Novo dialog cancelar |
| `src/components/orcamento/ConsolidarOrcamentoModal.tsx` | Novo modal consolidar |
| `src/components/orcamento/HistoricoAlteracoes.tsx` | Novo componente historico |
| `src/pages/eventos/SinistroAnalise.tsx` | Integrar CardOrcamentoReparo |
| `src/pages/eventos/SinistroDetalhe.tsx` | Integrar CardOrcamentoReparo |
| `src/pages/regulador/ReguladorOficina.tsx` | Resumo e acesso ao orcamento |

## Sem alteracoes em

- App do associado (nenhuma info de custo)
- Portal do sindicante (sem acesso a custos)
- Edge functions existentes
- Fluxo de cotacao de pecas (continua funcionando como esta)
- Tabelas `ordens_servico` / `ordens_servico_itens` (mantidas para fluxo de OS da oficina)

---

## Detalhes Tecnicos

### Triggers SQL para recalculo automatico

```text
-- Trigger em orcamento_reparo_itens (INSERT/UPDATE/DELETE)
-- Recalcula valor_pecas, valor_mao_obra, valor_total no orcamento_reparo pai
-- Exclui itens com status 'cancelado' do calculo
```

### Logica de permissao no frontend

```text
- canEdit = has_role(regulador) OR has_role(diretor)
- canEditConsolidado = has_role(diretor)
- canConsolidar = has_role(regulador) OR has_role(diretor)
- canView = has_role(regulador) OR has_role(analista_eventos) OR has_role(diretor)
```

### Formato do historico

Cada entrada segue o padrao:
```text
{
  acao: "item_editado",
  descricao: "Editou peca: Para-choque dianteiro — valor de R$ 800 para R$ 650",
  dados_anteriores: { valor_unitario: 800, valor_total: 800 },
  dados_novos: { valor_unitario: 650, valor_total: 650 },
  motivo: "Encontramos seminova por R$ 150 menos"
}
```

