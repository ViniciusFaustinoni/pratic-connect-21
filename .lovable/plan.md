
# Tela de Extrato por Associado

## Resumo

Criar uma nova pagina `ExtratoAssociado.tsx` no modulo financeiro que permite buscar um associado por CPF ou nome, e exibe todas as cobrancas (`asaas_cobrancas`) em ordem cronologica reversa, estilo extrato bancario. Ao clicar em uma cobranca do tipo mensalidade, um painel expansivel mostra a composicao detalhada do boleto (taxa administrativa, rateio por beneficio, adicionais) buscando da tabela `cobrancas_composicao`.

## Arquivo a Criar

### `src/pages/financeiro/ExtratoAssociado.tsx`

**Secao de Busca (topo):**
- Campo de busca com debounce (300ms) que pesquisa em `associados` por `cpf` (ilike) ou `nome` (ilike)
- Dropdown de resultados (max 10) mostrando nome, CPF e status
- Ao selecionar, carrega o perfil resumido e o extrato

**Cabecalho do Associado (apos selecao):**
- Card com: nome, CPF formatado, telefone, status, quantidade de veiculos
- Resumo financeiro: total pago (ultimos 12 meses), total em aberto, total vencido

**Extrato (timeline cronologica):**
- Lista de todas as `asaas_cobrancas` do associado (via `associado_id`)
- Ordenadas por `data_vencimento` descendente
- Cada linha mostra:
  - Data (vencimento ou pagamento)
  - Tipo (badge colorido: mensalidade, adesao, taxa, etc.)
  - Referencia/competencia
  - Valor original
  - Status (badge)
  - Valor pago (se houver)
- Agrupamento visual por mes/ano com separadores
- Filtros opcionais: periodo (de/ate), tipo, status

**Composicao Detalhada (expansivel):**
- Ao clicar em uma linha de mensalidade, expande um `Collapsible` abaixo
- Busca `cobrancas_composicao` com join em `veiculos(placa, marca, modelo)` pelo `cobranca_id`
- Para cada veiculo, mostra:
  - Placa / modelo
  - Taxa administrativa
  - Rateio roubo/furto
  - Rateio colisao
  - Rateio incendio
  - Rateio terceiros
  - Rateio vidros
  - Rateio assistencia
  - Adicionais (detalhe do JSON `valor_adicionais_detalhes`)
  - Subtotal do veiculo
- Rodape com total geral da composicao

## Arquivo a Modificar

### `src/App.tsx`

Adicionar rota:
```
<Route path="/financeiro/extrato-associado" element={<ExtratoAssociado />} />
```

Adicionar import do componente.

## Detalhes Tecnicos

- Busca de associados usa `ilike` com `%termo%` em `nome` e `cpf`
- Extrato busca `asaas_cobrancas` com `associado_id`, sem limite (ou limit 200)
- Composicao usa query separada por `cobranca_id`, carregada sob demanda ao expandir
- Agrupamento por mes feito no frontend com `useMemo`
- Dados da tabela `cobrancas_composicao`:
  - `valor_taxa_administrativa` -- taxa admin
  - `valor_rateio_roubo_furto`, `valor_rateio_colisao`, `valor_rateio_incendio`, `valor_rateio_terceiros`, `valor_rateio_vidros`, `valor_rateio_assistencia` -- rateios por beneficio
  - `valor_adicionais` + `valor_adicionais_detalhes` (JSON) -- adicionais
  - `veiculo_id` com join para exibir placa
- Nenhuma migracao de banco necessaria -- todos os dados ja existem
- Componente reutiliza patterns de `CobrancaDetalhe.tsx` (statusConfig, tipoConfig, formatCurrency)
