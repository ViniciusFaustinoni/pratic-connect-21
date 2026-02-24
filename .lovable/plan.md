
# Dois Caminhos de Orcamento: Cotacao Separada vs Pacote Fechado

## Resumo

Adicionar ao sistema a possibilidade do analista escolher entre dois tipos de orcamento ao solicitar reparo: **Cotacao Separada** (itemizada, fluxo atual) ou **Pacote Fechado** (valor unico com a oficina). A escolha e feita uma unica vez e determina toda a experiencia do orcamento daquele evento.

---

## Parte 1: Migracao SQL

Adicionar colunas na tabela `orcamento_reparo` existente:

```text
ALTER TABLE orcamento_reparo ADD COLUMN tipo_orcamento text DEFAULT 'cotacao_separada'
  CHECK (tipo_orcamento IN ('cotacao_separada', 'pacote_fechado'));

-- Campos exclusivos do Pacote Fechado
ALTER TABLE orcamento_reparo ADD COLUMN valor_pacote numeric(12,2);
ALTER TABLE orcamento_reparo ADD COLUMN descricao_pacote text;
ALTER TABLE orcamento_reparo ADD COLUMN prazo_estimado_dias integer;
ALTER TABLE orcamento_reparo ADD COLUMN forma_pagamento text;
ALTER TABLE orcamento_reparo ADD COLUMN observacao_negociacao text;
ALTER TABLE orcamento_reparo ADD COLUMN detalhamento_pacote jsonb;
```

Nova tabela para cotacoes de pecas (Caminho 1):

```text
CREATE TABLE orcamento_reparo_cotacoes (
  id uuid PK,
  item_id uuid FK -> orcamento_reparo_itens,
  fornecedor text NOT NULL,
  tipo_peca text CHECK ('original','seminova','paralela'),
  valor numeric(12,2),
  prazo_entrega text,
  observacao text,
  selecionada boolean DEFAULT false,
  created_at timestamptz
);
```

RLS: mesmas politicas do `orcamento_reparo_itens` (regulador, analista_eventos, diretor).

---

## Parte 2: Hook useOrcamentoReparo.ts -- Extensoes

Adicionar ao hook existente:

- `useCriarOrcamento`: aceitar `tipoOrcamento` ('cotacao_separada' | 'pacote_fechado') como parametro obrigatorio, salvar no campo `tipo_orcamento`
- `useAtualizarPacote()`: mutation para atualizar `valor_pacote`, `descricao_pacote`, `prazo_estimado_dias`, `forma_pagamento`, `observacao_negociacao`, `detalhamento_pacote` + registrar historico
- `useCotacoesItem(itemId)`: query para buscar cotacoes de uma peca
- `useAdicionarCotacao()`: mutation para inserir cotacao + se `selecionada=true`, atualizar `valor_unitario` do item
- `useRemoverCotacao()`: mutation para deletar cotacao

Atualizar interfaces TypeScript:

```text
OrcamentoReparo {
  ...campos existentes,
  tipo_orcamento: 'cotacao_separada' | 'pacote_fechado';
  valor_pacote: number | null;
  descricao_pacote: string | null;
  prazo_estimado_dias: number | null;
  forma_pagamento: string | null;
  observacao_negociacao: string | null;
  detalhamento_pacote: any;
}
```

---

## Parte 3: Modal de Escolha do Tipo de Orcamento

### Novo componente: `src/components/orcamento/EscolhaTipoOrcamentoModal.tsx`

Modal com dois cards selecionaveis lado a lado:

- Card "Cotacao Separada": icone clipboard, descricao com pros/contras, radio visual
- Card "Pacote Fechado": icone package, descricao com pros/contras, radio visual

Ao selecionar e clicar "Continuar":
1. Cria o `orcamento_reparo` com o `tipo_orcamento` escolhido
2. Se Pacote Fechado: abre a tela de pacote fechado
3. Se Cotacao Separada: abre a tela itemizada (fluxo atual)

Este modal substitui o botao "Criar Orcamento" atual no `CardOrcamentoReparo`.

---

## Parte 4: CardOrcamentoReparo -- Adaptar para Dois Tipos

### Arquivo: `src/components/orcamento/CardOrcamentoReparo.tsx`

Logica condicional baseada em `orcamento.tipo_orcamento`:

**Se `cotacao_separada`:**
- Mostrar badge "Cotacao Separada" no cabecalho
- Renderizar todo o fluxo atual (tabelas de pecas/mao de obra, abas, etc.)
- Adicionar coluna "Cotacoes" na tabela de pecas (link clicavel mostrando quantidade)

**Se `pacote_fechado`:**
- Mostrar badge "Pacote Fechado" no cabecalho
- 4 cards de resumo diferentes: Valor do Pacote, Oficina, Prazo, % da FIPE
- Card "Oficina Responsavel" com select de oficinas
- Card "Valor do Pacote" com campos: valor, descricao, prazo, forma de pagamento, observacoes
- Card "Detalhamento Opcional" colapsavel com mini-tabela (item/tipo/valor estimado)
- Card "Comparativo FIPE" automatico
- Botoes: Aprovar Pacote, Editar Valor (com motivo), Cancelar Pacote
- Historico de alteracoes (reutiliza componente existente)

Na pratica, o componente tera um `if/else` no render principal que escolhe entre `renderCotacaoSeparada()` e `renderPacoteFechado()`.

---

## Parte 5: Modal de Cotacoes por Peca (Caminho 1)

### Novo componente: `src/components/orcamento/CotacoesPecaModal.tsx`

Modal que abre ao clicar em "X cotacoes" na linha de uma peca:

- Titulo: "Cotacoes -- [nome da peca]"
- Tabela: Fornecedor, Tipo (Original/Seminova/Paralela), Valor, Prazo, Observacao, Radio "Selecionada"
- Botao "+ Adicionar Cotacao"
- Ao selecionar uma cotacao como escolhida: atualiza automaticamente o `valor_unitario` e `origem` do item no orcamento
- Alerta se oficina nao credenciada e menos de 3 cotacoes (art. 11.3)

---

## Parte 6: Formulario Pacote Fechado

### Novo componente: `src/components/orcamento/FormPacoteFechado.tsx`

Renderiza dentro do CardOrcamentoReparo quando tipo = pacote_fechado:

- Select de oficina (usa `useOficinasDisponiveis` existente)
- Campo valor pacote (monetario)
- Textarea "O que esta incluido" (obrigatorio)
- Input prazo estimado (dias uteis)
- Select forma de pagamento: "A vista apos conclusao" / "50% entrada + 50% entrega" / "Faturado" / "Outro"
- Textarea observacoes da negociacao (opcional)
- Secao colapsavel de detalhamento opcional com mini-tabela editavel

Botoes de acao:
- "Salvar": persiste dados no `orcamento_reparo`
- "Aprovar Pacote": muda status para 'execucao' e registra historico
- "Editar Valor": se orcamento ja aprovado, exige motivo obrigatorio

---

## Parte 7: Consolidacao do Pacote Fechado

### Atualizar: `src/components/orcamento/ConsolidarOrcamentoModal.tsx`

Adicionar variante para pacote fechado:
- Resumo mostra valor do pacote (em vez de pecas + mao de obra separados)
- Mostra variacao se valor foi alterado durante o reparo
- Mesmo fluxo de checkbox de confirmacao e bloqueio pos-consolidacao

---

## Parte 8: Integracao no SinistroAnalise e SinistroDetalhe

### `src/pages/eventos/SinistroAnalise.tsx` (linha ~1644)

O `CardOrcamentoReparo` ja esta integrado na aba "Orcamento". As mudancas sao internas ao componente -- nenhuma alteracao necessaria no SinistroAnalise exceto:

- Passar prop adicional `canChooseType` (true para analista_eventos e diretor)
- O card ja mostra o modal de escolha quando nao existe orcamento

### `src/pages/eventos/SinistroDetalhe.tsx`

Mesma logica -- o CardOrcamentoReparo se adapta internamente.

---

## Parte 9: Permissoes e Reset

### Reset do tipo de orcamento (somente diretor)

Botao discreto no CardOrcamentoReparo (visivel apenas para diretor):
"Resetar Orcamento" -> Dialog de confirmacao com motivo obrigatorio.

Ao resetar:
- Deleta o `orcamento_reparo` e seus itens/historico/cotacoes (CASCADE)
- Registra log
- O analista pode escolher novamente o tipo

### Permissoes no frontend

```text
canChooseType = analista_eventos OR diretor
canEditPacote = analista_eventos OR regulador OR diretor
canResetOrcamento = diretor (somente)
```

---

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| Nova migracao SQL | Colunas em `orcamento_reparo`, tabela `orcamento_reparo_cotacoes`, RLS |
| `src/hooks/useOrcamentoReparo.ts` | Novos hooks para pacote e cotacoes |
| `src/components/orcamento/EscolhaTipoOrcamentoModal.tsx` | Novo modal de escolha |
| `src/components/orcamento/CardOrcamentoReparo.tsx` | Adaptar para dois tipos |
| `src/components/orcamento/FormPacoteFechado.tsx` | Novo formulario pacote |
| `src/components/orcamento/CotacoesPecaModal.tsx` | Novo modal cotacoes por peca |
| `src/components/orcamento/ConsolidarOrcamentoModal.tsx` | Variante pacote fechado |

## Sem alteracoes em

- App do associado (nao ve custos)
- Portal do sindicante
- Edge functions existentes
- Fluxo de cotacao via WhatsApp (SolicitarOrcamentoDialog) -- continua como esta
- Tabela `ordens_servico` / `ordens_servico_itens` (fluxo de OS da oficina)
