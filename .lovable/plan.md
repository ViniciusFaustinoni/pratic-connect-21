

# Modulo de Elegibilidade de Veiculos

## Resumo
Adicionar a aba "Elegibilidade" na pagina Gestao Comercial (index 5), com 3 sub-abas internas: Por Plano, Importar PDF, Resumo Global. A tabela `plano_elegibilidade_modelos` ja existe no Supabase com tipos gerados.

## Arquivos a criar/editar

### 1. `src/components/gestao-comercial/ElegibilidadeVeiculos.tsx` (CRIAR)
Componente principal com 3 sub-abas usando Radix Tabs:

**Sub-aba "Por Plano":**
- Select de planos (query `planos` where `ativo = true`)
- Tabela listando registros de `plano_elegibilidade_modelos` filtrados por `plano_id` e `is_active = true`
- Colunas: Marca, Modelo, Ano Min, Ano Max ("Sem limite" se null), Combustivel ("Qualquer" se 'qualquer'), Status (badge colorido), Acoes
- Alerta amarelo quando 0 registros
- Botao "Adicionar Modelo" abre Sheet lateral com form (marca, modelo, ano_min, ano_max, combustivel, status, observacao)
- Validacao de duplicata antes de insert
- Editar: mesma Sheet preenchida, update no registro
- Desativar: update `is_active = false`

**Sub-aba "Importar PDF":**
- Dropzone com react-dropzone (ja instalado), accept `.pdf`
- Botao "Processar PDF" mostra toast/alert "Importacao via PDF sera habilitada em breve."
- Sem logica real de parsing

**Sub-aba "Resumo Global":**
- Query com LEFT JOIN + COUNT FILTER para totais por plano
- Tabela: Plano, Linha, Total, Aceitos, Limitados, Negados, Ultima Atualizacao
- Linhas com total=0 recebem bg amarelo + badge "Sem configuracao"

### 2. `src/components/gestao-comercial/TabNavigation.tsx` (EDITAR)
Adicionar tab index 5: `{ label: 'Elegibilidade', icon: ShieldCheck }`

### 3. `src/pages/diretoria/GestaoComercial.tsx` (EDITAR)
Importar e renderizar `ElegibilidadeVeiculos` para `activeTab === 5`

## Padrao seguido
- Mesmo padrao de componentes existentes (SimuladorRateio, ProdutosPlanos): queries inline com `useQuery`, supabase client direto, componentes shadcn/ui
- Sheet lateral para formularios (padrao ja usado no projeto)
- Toast via sonner para feedback
- Sem hooks separados — tudo inline no componente (consistente com as outras abas)

## Sem alteracoes
- Nenhuma migration SQL (tabela ja existe)
- Nenhuma alteracao em `usePlanosCotacao.ts`
- Nenhum arquivo fora de `gestao-comercial/` e `GestaoComercial.tsx`

