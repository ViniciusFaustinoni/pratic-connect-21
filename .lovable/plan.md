
# Correção do Salvamento de Valores e Atribuição de Estabelecimento por Peça

## Problemas Identificados

1. **Valores não aparecem após salvar**: O código invalida a query `sinistro-analise` (linha 984), mas os dados da vistoria vêm da query `sinistro-analise-vistoria-evento`. O cache antigo continua sendo exibido.
2. **Botão "Salvar Valores" desaparece**: Após salvar, `setValoresPecas({})` esvazia o estado e a condição `Object.keys(valoresPecas).length > 0` esconde o botão. Isso impede edições futuras.
3. **Sem seleção de estabelecimento**: Não existe campo para o analista indicar qual Auto Center, Ferro Velho ou Montadora informou o valor da peça.

---

## Alterações

### 1. Corrigir invalidação de cache

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx` (linha 984)

Após salvar, invalidar também a query correta:
- `sinistro-analise-vistoria-evento` (que alimenta `vistoriaEvento`)

### 2. Manter botão "Salvar Valores" sempre visível para peças

Trocar a condição de exibição do botão. Em vez de esconder quando `valoresPecas` está vazio, exibir sempre que existam itens do tipo `peca` na lista. Desabilitar o botão quando não houver alterações pendentes.

### 3. Adicionar seletor de estabelecimento por peça

Para cada linha de peça na tabela, adicionar um `Select` (dropdown) ao lado do campo de valor, permitindo ao analista escolher de qual estabelecimento veio aquele preço.

- Usar o hook `useAutoCenters({ marca })` já existente para listar estabelecimentos compatíveis
- Armazenar em estado local `fornecedoresPecas: Record<number, { id: string, nome: string }>` (indexado pelo índice do item)
- O dropdown exibe nome e tipo (Auto Center / Ferro Velho / Montadora)

### 4. Salvar estabelecimento junto com o valor no JSONB

Ao salvar, incluir `fornecedor_id` e `fornecedor_nome` em cada item de peça no array `itens_orcamento`:

```text
{
  descricao: "Para-choque...",
  tipo: "peca",
  quantidade: 1,
  valor_unitario: 350,
  valor_total: 350,
  fornecedor_id: "uuid-do-auto-center",
  fornecedor_nome: "Auto Peças XYZ"
}
```

### 5. Exibir estabelecimento na tabela

Adicionar uma coluna "Fornecedor" na tabela de itens do orçamento. Para peças com `fornecedor_nome` já salvo, exibir o nome. Para peças sem fornecedor, exibir o dropdown de seleção.

### 6. Salvar peça no catálogo do estabelecimento

Ao salvar valores, para cada peça com fornecedor selecionado, criar/atualizar um registro na tabela `auto_center_pecas` com:
- `auto_center_id`: o fornecedor selecionado
- `nome`: descrição da peça
- `valor`: valor unitário informado
- `condicao`: tipo da peça (nova, usada, etc.)
- `veiculo_marca`, `veiculo_modelo`, `veiculo_ano`: dados do veículo do sinistro

---

## Arquivos afetados

| Arquivo | Alteração |
|---|---|
| `src/pages/eventos/SinistroAnalise.tsx` | Corrigir invalidação de cache; manter botão visível; adicionar coluna e seletor de fornecedor; salvar fornecedor no JSONB e em `auto_center_pecas` |

## Layout da tabela após alteração

```text
| Descrição | Tipo | Qtd | Fornecedor        | Valor Unit. |
|-----------|------|-----|-------------------|-------------|
| Para-ch...| Peça |  1  | [Select dropdown] | [Input R$]  |
| Troca ... | MO   |  1  | ---               | R$ 150,00   |
```
