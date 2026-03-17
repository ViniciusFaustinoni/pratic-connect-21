

## Entendimento

A funcionalidade que você quer **NÃO** é um painel de acionamentos de roubo/furto (ocorrências). O que precisa existir é:

**Uma área para o analista de monitoramento analisar e aprovar novos associados** -- o trabalho que antes era todo do analista de cadastro. A divisão agora é:

- **Analista de monitoramento** → analisa e aprova propostas para **cobertura Roubo/Furto** (a primeira aprovação, antes da instalação do rastreador)
- **Analista de cadastro** → aprova apenas **cobertura completa/360** (após instalação do rastreador)

## Plano

### 1. Substituir a página `AcionamentosRouboFurto.tsx`

Reescrever completamente `src/pages/monitoramento/AcionamentosRouboFurto.tsx` para ser um painel de **Análise e Aprovação de Associados**, reutilizando a mesma lógica de `PropostasPendentes` mas filtrado para o contexto do monitoramento:

- Listar contratos com status `assinado` (propostas pendentes de aprovação)
- Mesma estrutura visual: cards com dados do cliente, veículo, placa, documentos, vistoria
- Ações: **Aprovar** (reutilizar `useAprovarProposta`), **Reprovar**, **Solicitar documentos**
- Ao clicar no card, navegar para `/cadastro/propostas/:id` (reutiliza `PropostaAnalise` existente)

### 2. Atualizar sidebar e breadcrumb

- Renomear item do menu: "Acionamentos Roubo/Furto" → "Aprovação de Associados"
- Manter rota `/monitoramento/aprovacao-associados` (renomear de `acionamentos-roubo`)
- Atualizar breadcrumb

### 3. Atualizar `PropostasPendentes` do cadastro (futuro)

Adicionar nota/badge indicando que o analista de cadastro agora só lida com **ativações de cobertura completa** (pós-instalação), usando o hook `useInstalacoesAguardandoAtivacao` que já existe.

### Arquivos afetados

- `src/pages/monitoramento/AcionamentosRouboFurto.tsx` → reescrever como painel de aprovação de associados
- `src/components/layout/AppSidebar.tsx` → renomear item menu
- `src/components/layout/GlobalBreadcrumb.tsx` → atualizar breadcrumb
- `src/App.tsx` → atualizar rota

