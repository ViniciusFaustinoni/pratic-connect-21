

# Adicionar variaveis faltantes ao seletor de templates

## Problema

O backend ja resolve corretamente todas essas variaveis no mapeamento (`criarMapeamentoVariaveis` em `template-utils.ts`). Porem, o componente `VariaveisSelector.tsx` -- que e o painel lateral usado ao editar templates -- nao lista varias delas. Isso impede o usuario de inseri-las nos templates.

## Variaveis que existem no backend mas faltam no seletor

| Variavel | Grupo | Backend | Seletor |
|---|---|---|---|
| `associado.cnh` | associado | Mapeado (linha 59) | NAO listado |
| `associado.cnh_validade` | associado | Mapeado (linha 60) | NAO listado |
| `associado.cnh_categoria` | associado | Mapeado (linha 61) | NAO listado |
| `associado.rg_orgao` | associado | Mapeado (linha 44) | NAO listado |
| `veiculo.cambio` | veiculo | Mapeado (linha 82) | NAO listado |
| `veiculo.portas` | veiculo | Mapeado (linha 83) | NAO listado |
| `veiculo.leilao` | veiculo | Mapeado (linha 84) | NAO listado |
| `veiculo.uso_aplicativo` | veiculo | Mapeado (linha 85) | NAO listado |
| `veiculo.valor_protegido` | veiculo | Mapeado (linha 86) | NAO listado |
| `consultor.nome` | consultor | Mapeado (linha 89) | Grupo inteiro NAO existe |

## Solucao

### Arquivo: `src/components/documentos/VariaveisSelector.tsx`

1. Adicionar ao grupo `associado`:
   - `associado.cnh` - Numero da CNH
   - `associado.cnh_validade` - Validade da CNH
   - `associado.cnh_categoria` - Categoria da CNH (A, B, AB...)
   - `associado.rg_orgao` - Orgao emissor do RG

2. Adicionar ao grupo `veiculo`:
   - `veiculo.cambio` - Tipo de cambio (Manual/Automatico)
   - `veiculo.portas` - Numero de portas
   - `veiculo.leilao` - Veiculo proveniente de leilao (SIM/NAO)
   - `veiculo.uso_aplicativo` - Utilizado para aplicativo (SIM/NAO)
   - `veiculo.valor_protegido` - Valor protegido (R$)

3. Criar novo grupo `consultor`:
   - `consultor.nome` - Nome do consultor/vendedor

4. Adicionar icone do grupo consultor ao mapa `iconesPorGrupo` (usar icone `User`)

5. Adicionar estado inicial `consultor: false` no `expandido`

## Resultado

Apos essa alteracao, ao editar qualquer template, o painel lateral de variaveis mostrara todas as variaveis acima. O usuario podera inseri-las no corpo do template e elas serao preenchidas automaticamente na geracao do documento.

Apenas **1 arquivo** precisa ser alterado: `src/components/documentos/VariaveisSelector.tsx`.
