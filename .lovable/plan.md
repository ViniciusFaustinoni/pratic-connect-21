

# Importação em Massa de Linhas Completas (com Planos, Coberturas e Benefícios)

## Resumo

Adicionar na seção **Linhas e Planos** da Gestão Comercial:
1. Botão **"Importar"** ao lado de "Nova Linha"
2. Ao clicar, abre modal com opção de **baixar template XLSX** e fazer **upload da planilha preenchida**
3. O sistema processa a planilha e cria: linhas, planos, coberturas (no catálogo se não existirem), benefícios (idem), vínculos plano↔cobertura e plano↔benefício

## Template XLSX (gerado client-side)

A planilha terá **uma aba única** com as seguintes colunas:

| Coluna | Descrição | Obrigatória |
|--------|-----------|-------------|
| Linha | Nome da linha de produto | Sim |
| Plano | Nome do plano | Sim |
| Tipo Item | `cobertura` ou `beneficio` | Sim |
| Nome Item | Nome da cobertura/benefício | Sim |
| Código Item | Código único | Sim |
| Descrição Item | Descrição | Não |
| Valor (R$) | Valor mensal do item | Sim |
| Categoria | Para benefícios: `assistencia`, `extra`, `geral` | Não |
| Carência Ativa | `sim` ou `não` | Não |
| Carência Tipo | `liberacao` ou `multiplicadora_cota` | Não |
| Carência Dias | Número inteiro | Não |
| Carência Multiplicador | Ex: 2.0 | Não |
| Franquia % | Para coberturas | Não |
| Franquia Valor | Para coberturas | Não |
| % Cobertura | Para coberturas | Não |
| Valor Limite | Para coberturas | Não |

Cada linha da planilha é um item (cobertura ou benefício) vinculado a um plano que pertence a uma linha. Múltiplas linhas da planilha com mesmo "Linha + Plano" agrupam itens no mesmo plano.

## Lógica de Processamento

1. Parse do XLSX via `xlsx` (SheetJS) — já usado no projeto
2. Agrupar por Linha → Plano → Itens
3. Para cada Linha: `upsert` em `product_lines` (por nome)
4. Para cada Plano: `insert` em `planos` vinculado à linha
5. Para cada Item tipo `cobertura`: `upsert` em `coberturas` (por código), depois `insert` em `planos_coberturas`
6. Para cada Item tipo `beneficio`: `upsert` em `benefits` (por slug gerado do código), depois `insert` em `planos_beneficios`
7. Exibir resumo: X linhas, Y planos, Z coberturas, W benefícios criados

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/gestao-comercial/ImportarLinhasModal.tsx` | Novo — Modal com download template + upload + processamento |
| `src/components/gestao-comercial/LinhasPlanos.tsx` | Adicionar botão "Importar" e renderizar modal |

## Dependências

- `xlsx` (SheetJS) — verificar se já está instalado; se não, instalar

