

# Prioridade da IA sobre Valores Manuais nas Pecas

## Contexto

O analista de eventos tem dois fluxos para preencher valores de pecas:

1. **Manual**: preenche valores e fornecedores diretamente na tabela de itens do orcamento (salva em `vistorias_evento.dados_vistoria.itens_orcamento`)
2. **Automatizado (IA)**: solicita orcamentos via WhatsApp, a IA coleta respostas e armazena em `evento_cotacoes_pecas` (com `resposta.itens[].valor_unitario`)

Regra: se ambos os fluxos preencherem valores, **o da IA deve sempre prevalecer**.

---

## Alteracoes

### 1. Na tabela de itens do orcamento, exibir valores da IA quando existirem

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx`

Na renderizacao da tabela de itens do orcamento (pecas), verificar se existe uma cotacao aprovada (`evento_cotacoes_pecas` com `aprovada = true`). Se existir:

- Para cada peca, usar o valor da cotacao aprovada (`resposta.itens[index].valor_unitario`) em vez do valor manual salvo no JSONB
- Mostrar o nome do Auto Center da cotacao aprovada como fornecedor
- Tornar os campos de valor e fornecedor **somente leitura** com indicador visual de que o valor veio da IA (badge "Via Cotacao")
- Desabilitar o botao "Salvar Valores" (pois a IA prevalece)

Se nao existir cotacao aprovada mas existirem cotacoes respondidas, manter campos editaveis mas exibir aviso de que ha cotacoes pendentes de aprovacao.

### 2. Buscar cotacao aprovada no hook existente

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx`

Adicionar uso do hook `useCotacoesEvento(sinistro.id)` na pagina para obter a lista de cotacoes. Identificar a cotacao aprovada (`cotacoes.find(c => c.aprovada)`) e usar seus dados para sobrescrever os valores manuais na tabela.

### 3. Logica de prioridade

```text
Para cada peca na tabela:
  1. Se existe cotacao aprovada com valor para esta peca -> exibir valor da IA (somente leitura)
  2. Senao, se existe valor manual (JSONB) -> exibir valor manual (editavel)
  3. Senao -> campo vazio editavel
```

---

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| `src/pages/eventos/SinistroAnalise.tsx` | Importar `useCotacoesEvento`; na tabela de itens, verificar cotacao aprovada e sobrescrever valores manuais; desabilitar edicao quando IA preencheu |

## Layout da tabela apos alteracao

```text
| Descricao      | Tipo | Qtd | Fornecedor              | Valor Unit.            |
|----------------|------|-----|-------------------------|------------------------|
| Para-choque... | Peca |  1  | Auto Pecas XYZ [IA]     | R$ 350,00 [Via Cotacao]|
| Troca ...      | MO   |  1  | ---                     | R$ 150,00              |
```

Quando valores vem da IA:
- Campo de valor mostra o valor com fundo diferenciado e badge "Via Cotacao"
- Dropdown de fornecedor mostra o Auto Center da cotacao aprovada (nao editavel)
- Botao "Salvar Valores" fica desabilitado com tooltip explicativo

