
# Tela de Configuracao do Rateio

## Resumo

Criar uma nova pagina dedicada "Configuracao do Rateio" dentro do modulo Configuracoes, acessivel apenas por Diretores. A pagina tera: edicao dos parametros do rateio, multiplicadores por tipo de veiculo, simulador de impacto em tempo real e historico de alteracoes.

## Dados existentes no banco

O banco ja possui na tabela `configuracoes` os seguintes registros relevantes:
- `atuarial_valor_por_cota` = 5000 (valor base da cota)
- `financeiro_dia_vencimento_padrao` = 10

E a tabela `faixas_taxa_administrativa` com 9 faixas definidas por valor FIPE (de R$0 a R$180.000).

Sera necessario criar novos registros de configuracao para: multiplicadores por tipo de veiculo, taxa administrativa fixa, dia de fechamento. E uma tabela para historico de alteracoes.

## Arquivos a criar/modificar

### 1. Migration SQL (nova)

Inserir novos registros na tabela `configuracoes`:
- `rateio_multiplicador_passeio` = "1.0" (numero)
- `rateio_multiplicador_aplicativo` = "1.3" (numero)
- `rateio_multiplicador_diesel` = "1.2" (numero)
- `rateio_multiplicador_moto` = "1.5" (numero)
- `rateio_taxa_administrativa` = "29.90" (moeda)
- `rateio_dia_fechamento` = "25" (numero)
- `rateio_dia_vencimento` = "10" (numero)

Criar tabela `configuracoes_historico` para registrar cada alteracao:
- `id`, `chave`, `valor_anterior`, `valor_novo`, `alterado_por` (FK profiles), `alterado_em` (timestamp)
- RLS: leitura apenas para diretores

### 2. `src/pages/configuracoes/RateioConfig.tsx` (novo)

Pagina completa com:

**Secao 1 - Valor Base da Cota**
- Campo monetario com o valor atual (busca `atuarial_valor_por_cota`)
- Alerta de confirmacao ao salvar ("Atencao: alterar o valor base afeta o calculo de TODOS os associados...")

**Secao 2 - Multiplicadores por Tipo de Veiculo**
- 4 campos numericos com step 0.1 (passeio, aplicativo, diesel, moto)
- Validacao: entre 0.5 e 5.0

**Secao 3 - Taxa Administrativa Mensal**
- Campo monetario (nao pode ser negativo)

**Secao 4 - Dia de Fechamento e Vencimento**
- Dois campos numericos (1 a 28)

**Secao 5 - Simulador de Impacto**
- Input: valor FIPE hipotetico + tipo de veiculo (select)
- Output calculado em tempo real: quantidade de cotas, multiplicador aplicado, valor estimado de rateio (usando ultimo fechamento)

**Secao 6 - Historico de Alteracoes**
- Tabela com: campo alterado, valor anterior, valor novo, quem alterou, quando

Todas as alteracoes passam por dialog de confirmacao e gravam no historico.

### 3. `src/pages/configuracoes/components/ConfiguracoesSidebar.tsx` (editar)

Adicionar item "Rateio" na secao "Administracao" (que ja e `adminOnly`), verificando adicionalmente se o usuario e diretor. Usar icone `Calculator`.

### 4. `src/pages/configuracoes/components/ConfiguracoesMobileNav.tsx` (editar)

Mesmo item de menu para a navegacao mobile.

### 5. `src/App.tsx` (editar)

Adicionar rota `<Route path="rateio" element={<RateioConfig />} />` dentro do grupo `/configuracoes`.

### 6. `src/pages/configuracoes/index.tsx` (editar)

Exportar o novo componente `RateioConfig`.

## Controle de acesso

- O item de menu so aparece para usuarios com role `diretor` (verificado via `usePermissions`)
- A pagina em si tambem verifica permissao e redireciona se nao autorizado
- RLS da tabela `configuracoes_historico` restringe leitura a diretores

## Detalhes tecnicos

- Cada campo salva individualmente via mutation que faz UPDATE na tabela `configuracoes` e INSERT no `configuracoes_historico`
- O simulador e puramente client-side, usando os valores editados (antes de salvar) para calculo em tempo real
- O historico busca da tabela `configuracoes_historico` filtrado pelas chaves do rateio
- Validacoes com zod antes de permitir salvar
