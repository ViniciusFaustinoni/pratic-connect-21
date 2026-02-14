

# Usar Modal Estruturado de Pecas no Orcamento do Regulador

## Contexto

Atualmente, no modal "Orcamento da Vistoria" do regulador (`VistoriaEventoOrcamento`), os itens do tipo "peca" sao adicionados com um campo de texto livre para descricao. O regulador digita manualmente o nome da peca, o que gera dados inconsistentes.

O modal "Adicionar Peca" dos Auto Centers (`AutoCenterPecaFormDialog`) ja possui selecoes estruturadas com busca: Tipo de Peca, Marca, Modelo, Ano (via API FIPE).

## Solucao

Quando o regulador adicionar um item do tipo "peca" ao orcamento, ele devera usar o mesmo formulario estruturado (com os comboboxes buscaveis), porem **sem o campo de valor**. O valor sera preenchido posteriormente pelo analista de eventos apos receber as cotacoes.

Para itens do tipo "mao_de_obra" e "servico", o formulario atual (texto livre + valor) continua funcionando normalmente.

## Alteracoes

### 1. Criar componente reutilizavel `PecaSelectFields`

**Novo arquivo:** `src/components/oficinas/PecaSelectFields.tsx`

Extrair a logica dos 4 comboboxes (Tipo de Peca, Marca FIPE, Modelo FIPE, Ano FIPE) do `AutoCenterPecaFormDialog` para um componente reutilizavel. Props:

- `tipoPeca` / `onTipoPecaChange` -- valor e setter do tipo de peca
- `marcaNome` / `onMarcaChange` -- marca selecionada (nome + codigo)
- `modeloNome` / `onModeloChange` -- modelo selecionado
- `anoNome` / `onAnoChange` -- ano selecionado
- `disabled?` -- desabilitar todos os campos

Este componente encapsula os estados de loading, listas FIPE e logica de cascata.

### 2. Refatorar `AutoCenterPecaFormDialog`

Substituir os 4 blocos de combobox pelo novo `PecaSelectFields`, mantendo a mesma funcionalidade.

### 3. Modificar `VistoriaEventoOrcamento`

No formulario de itens do orcamento, quando o tipo do item for "peca":

- Substituir o `Input` de descricao pelo componente `PecaSelectFields`
- Remover os campos de valor unitario, quantidade e total (o valor sera informado pelo analista posteriormente)
- A descricao sera gerada automaticamente concatenando os campos (ex: "Para-choque Dianteiro - Toyota Corolla 2013")

Quando o tipo for "mao_de_obra" ou "servico":

- Manter o formulario atual com texto livre e campos de valor

### 4. Atualizar a interface `ItemOrcamento`

Adicionar campos opcionais para os dados estruturados da peca:

- `tipo_peca?: string`
- `veiculo_marca?: string`
- `veiculo_modelo?: string`
- `veiculo_ano?: string`

Estes campos serao salvos junto ao orcamento para uso posterior pelo analista.

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Criar | `src/components/oficinas/PecaSelectFields.tsx` |
| Modificar | `src/components/oficinas/AutoCenterPecaFormDialog.tsx` -- usar PecaSelectFields |
| Modificar | `src/components/regulador/VistoriaEventoOrcamento.tsx` -- usar PecaSelectFields para itens tipo "peca", remover valor |

Nenhuma alteracao de banco de dados necessaria -- os dados estruturados ja sao salvos como JSON dentro de `dados_vistoria`.

