

# Refatorar formulario de cotacao com filtros dinamicos das Tabelas de Apoio

## Problema atual

O formulario `CotacaoFormDialog.tsx` usa dados hardcoded em varios pontos:
- **Regioes**: constante `REGIOES` fixa (linhas 85-91) em vez de ler do banco
- **Uso do veiculo**: apenas 2 opcoes fixas (particular/aplicativo) em vez de ler `tipos_uso` do banco
- **Tipo de Placa**: nao existe no formulario
- **Tipo de veiculo / Combustivel**: detectados pela FIPE mas nao fazem match com os tipos criados no sistema
- **Ano**: ja e tratado pelo hook `usePlanosCotacao` mas sem feedback visual

## Alteracoes

| Arquivo | Acao |
|---|---|
| `CotacaoFormDialog.tsx` | Substituir `REGIOES` hardcoded por `useRegioesAtivas()` |
| `CotacaoFormDialog.tsx` | Substituir cards fixos Passeio/Aplicativo por dropdown dinamico de `tipos_uso` |
| `CotacaoFormDialog.tsx` | Adicionar dropdown de **Tipo de Placa** (lendo `tipos_placa` do banco) |
| `CotacaoFormDialog.tsx` | Apos area FIPE: exibir **Tipo de Veiculo** detectado (match por similaridade com `categorias_veiculo_plano`) e **Combustivel** detectado (match com `combustiveis`) — campos read-only auto-preenchidos pela FIPE, editaveis manualmente |
| `CotacaoFormDialog.tsx` | Passar `combustivel`, `tipoPlaca` e `tipoUso` resolvidos para `usePlanosCotacao` |
| `usePlanosCotacao.ts` | Adicionar `tipoPlaca` ao `CalcularPlanosParams` e usar nas regras de elegibilidade |

## Detalhes tecnicos

### 1. Regioes dinamicas
Remover constante `REGIOES` (linhas 85-91). Importar `useRegioesAtivas` de `@/hooks/useRegioes`. Mapear `regioes` para options do Select.

### 2. Uso do veiculo dinamico
Importar `useConfiguracaoJson` para ler `tipos_uso`. Renderizar como dropdown `Select` em vez dos 2 cards fixos. O valor selecionado alimenta o parametro `usoApp` (se o valor selecionado contem "aplicativo" ou "app") e tambem e passado como `modalidadeUso` para elegibilidade.

### 3. Tipo de Placa (novo campo)
Novo bloco apos Regiao ou Uso. Dropdown com opcoes de `tipos_placa`. Valor passado para `usePlanosCotacao` como `tipoPlaca`.

### 4. Match FIPE → Tipo de Veiculo e Combustivel
Quando a FIPE retorna dados (por placa ou selecao manual):
- **Tipo de veiculo**: ja detectado pelo hook `useDetectarTipoVeiculo` (carro/moto). Exibir como badge informativo. Fazer match por similaridade com `categorias_veiculo_plano` do banco para alimentar elegibilidade.
- **Combustivel**: extrair de `veiculoEncontrado.vehicleData.combustivel` ou do ano FIPE (ex: "2022 Gasolina"). Fazer match normalizado com lista de `combustiveis` do banco. Exibir como dropdown pre-selecionado, editavel.
- **Ano**: ja e passado para `usePlanosCotacao`. Manter como esta.

### 5. Persistencia
Adicionar `tipo_placa` e `combustivel` ao payload de criacao/edicao da cotacao (campos ja existentes ou a criar na tabela `cotacoes`). Verificar se as colunas existem; se nao, criar migration.

### 6. Ordem dos blocos no formulario
```text
1. Dados do Associado (Nome, Telefone, Email, Indicacao)
2. Vencimento
3. Regiao (dropdown dinamico)
4. Uso do Veiculo (dropdown dinamico)
5. Tipo de Placa (dropdown dinamico — NOVO)
6. Consultor Responsavel (se lideranca)
7. Veiculo (placa + selecao manual FIPE)
8. Valor FIPE
9. Info FIPE: Tipo de Veiculo detectado + Combustivel (auto-preenchidos, editaveis)
10. Condicoes Especiais / Desagios
11. Cenario Vendedor Externo
12. Taxa de Filiacao
13. Planos disponiveis
14. Valor Adicional
15. FIPE Menor
16. Migracacao
17. Validade + Acoes
```

