

# Plano: Mover "Rateio" de Configurações para Diretoria

## Situação Atual

- A página `RateioConfig` (valor da cota, multiplicadores, taxa administrativa) está em `/configuracoes/rateio` — acessível via aba "Rateio" dentro de Configurações.
- Na Diretoria já existem: `Gestão Comercial` (com aba "Simulador de Rateio"), `Fechamento & Rateio`, e `Faixas & Cotas`.
- O conteúdo de configuração do rateio pertence logicamente à Diretoria, não a Configurações gerais.

## O que será feito

### 1. Adicionar aba "Configuração do Rateio" na Gestão Comercial

- Adicionar nova aba no `TabNavigation.tsx` (entre "Simulador de Rateio" e "Elegibilidade"):
  - Label: "Configuração do Rateio", ícone: `Settings`
- No `GestaoComercial.tsx`, importar `RateioConfig` e renderizar na nova aba (index 4, deslocando as demais).

### 2. Remover de Configurações

- `ConfiguracoesLayout.tsx`: remover a tab "Rateio" do array `tabs`.
- `App.tsx`: remover a rota `rateio` de dentro de `/configuracoes`, adicionar redirect `/configuracoes/rateio` → `/diretoria/gestao-comercial`.
- `src/pages/configuracoes/index.tsx`: remover export do `RateioConfig`.

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/gestao-comercial/TabNavigation.tsx` | +1 aba "Configuração do Rateio" |
| `src/pages/diretoria/GestaoComercial.tsx` | Importar e renderizar RateioConfig na nova aba |
| `src/pages/configuracoes/ConfiguracoesLayout.tsx` | Remover tab "Rateio" |
| `src/App.tsx` | Remover rota, adicionar redirect |
| `src/pages/configuracoes/index.tsx` | Remover export |

