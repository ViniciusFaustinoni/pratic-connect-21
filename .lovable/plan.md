## Objetivo

Tirar o card de ativação de rastreador da tela `/cadastro/propostas` e exibi-lo na aba `/monitoramento/aprovacao-associados`, que é o lugar correto (Monitoramento já é responsável por aprovar instalações concluídas).

## Mudanças

### 1. Remover de `src/pages/cadastro/PropostasPendentes.tsx`
- Apagar o bloco do alerta roxo "Aprovação pendente: ativação de rastreador" (linhas ~232–312).
- Remover imports/estado não mais usados nessa página: `useInstalacoesAguardandoAtivacao`, `ativacoesExpandido`/`setAtivacoesExpandido`, `AlertCircle`, `ChevronDown`, `ChevronUp`, `Zap`, `ArrowRight` (manter os que ainda forem usados em outros pontos da página — verificar antes de remover cada um).

### 2. Adicionar em `src/pages/monitoramento/AcionamentosRouboFurto.tsx` (página "Aprovação de Associados")
- Importar `useInstalacoesAguardandoAtivacao` de `@/hooks/useVistoriaCompletaAnalise`.
- Renderizar o mesmo card colapsável no topo do conteúdo (logo abaixo do header, antes dos KPIs), com idêntico visual roxo, contador, lista de instalações pendentes e botão "Ativar" navegando para `/cadastro/instalacoes/:id/ativar` (rota da tela de ativação permanece onde está — só o ponto de entrada muda).

### 3. Sem alterações de rota / hook / edge function
- A rota `/cadastro/instalacoes/:id/ativar` (`VistoriaCompletaAnalise`) continua existindo e funcionando.
- O hook `useInstalacoesAguardandoAtivacao` permanece igual.
- Nenhuma migração de banco necessária.

## Observação
A página `AcionamentosRouboFurto.tsx` já lista instalações concluídas aguardando aprovação do Monitoramento via `useInstalacoesAguardandoAprovacao` (baseado em `servicos`). O card de ativação de rastreador é uma camada complementar (baseada em `instalacoes` com `cobertura_roubo_furto=true` e `cobertura_total=false`) — coexistirá com a listagem principal sem conflito.
