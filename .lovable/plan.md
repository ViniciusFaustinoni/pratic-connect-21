
# Reformular Formulario de Pecas com Selecao Estruturada

## Problema Atual

O formulario "Adicionar Peca" usa um campo de texto livre para o nome da peca. O usuario precisa digitar tudo manualmente (ex: "Para Choque Dianteiro Corolla 2013"). Isso gera dados inconsistentes e dificulta buscas futuras.

## Solucao

Substituir o campo de texto por selecoes em cascata:

1. **Tipo de Peca** -- selecionar de uma lista predefinida (Para-choque dianteiro, Farol, Capo, etc.)
2. **Marca do Veiculo** -- selecionar usando a API FIPE (ja existente no sistema)
3. **Modelo do Veiculo** -- carregado automaticamente apos selecionar a marca
4. **Ano do Veiculo** -- carregado automaticamente apos selecionar o modelo
5. **Valor (R$)** e **Condicao** -- mantidos como estao

O campo `nome` no banco sera preenchido automaticamente concatenando os dados selecionados (ex: "Para-choque Dianteiro - Toyota Corolla 2013").

## Alteracoes no Banco de Dados

Adicionar colunas na tabela `auto_center_pecas` para armazenar os dados estruturados:

| Coluna | Tipo | Descricao |
|---|---|---|
| tipo_peca | text | Tipo selecionado (ex: "Para-choque Dianteiro") |
| veiculo_marca | text | Nome da marca (ex: "Toyota") |
| veiculo_modelo | text | Nome do modelo (ex: "Corolla") |
| veiculo_ano | text | Ano do modelo (ex: "2013") |

O campo `nome` existente sera mantido e preenchido automaticamente com a concatenacao.

## Catalogo de Pecas

Criar constante `CATALOGO_PECAS` em `src/lib/fornecedores-constants.ts` com itens como:

```text
Para-choque Dianteiro
Para-choque Traseiro
Farol Dianteiro Direito
Farol Dianteiro Esquerdo
Lanterna Traseira Direita
Lanterna Traseira Esquerda
Capo
Tampa Traseira / Porta-malas
Paralama Dianteiro Direito
Paralama Dianteiro Esquerdo
Porta Dianteira Direita
Porta Dianteira Esquerda
Porta Traseira Direita
Porta Traseira Esquerda
Retrovisor Direito
Retrovisor Esquerdo
Para-brisa
Vidro Traseiro
Vidro Lateral
Grade Dianteira
Painel / Frontal
Radiador
Motor de Arranque
Alternador
Compressor Ar Condicionado
Caixa de Cambio
Motor Completo
Suspensao Dianteira
Suspensao Traseira
Roda / Aro
```

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Migrar | `auto_center_pecas` -- adicionar colunas tipo_peca, veiculo_marca, veiculo_modelo, veiculo_ano |
| Modificar | `src/lib/fornecedores-constants.ts` -- adicionar CATALOGO_PECAS |
| Reescrever | `src/components/oficinas/AutoCenterPecaFormDialog.tsx` -- selecoes em cascata usando hook useFipe |
| Modificar | `src/hooks/useAutoCenters.ts` -- atualizar interface AutoCenterPeca com novos campos |

## Detalhes Tecnicos

### Formulario (AutoCenterPecaFormDialog)

- Select para tipo de peca (CATALOGO_PECAS)
- Select para marca (usando `useFipe().getMarcas()`)
- Select para modelo (carrega ao selecionar marca, usando `useFipe().getModelos()`)
- Select para ano (carrega ao selecionar modelo, usando `useFipe().getAnos()`)
- Input de valor e select de condicao (mantidos)
- No submit, salvar todos os campos individuais + concatenar em `nome`

### Interface AutoCenterPeca

Adicionar campos opcionais: `tipo_peca`, `veiculo_marca`, `veiculo_modelo`, `veiculo_ano`.
