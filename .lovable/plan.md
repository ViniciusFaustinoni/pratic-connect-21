## ERRO 12 — Estado atual

A funcionalidade do gate SGA financeiro já existe em `SituacaoFinanceiraGate.tsx` (botão "Consultar SGA novamente" + bypass auditado nos casos INCONCLUSIVO e INADIMPLENTE). Esta correção fecha os dois gaps restantes.

## Mudanças

**1. Bypass também no estado de erro do SGA** (`src/components/cadastro/SituacaoFinanceiraGate.tsx`, bloco `if (isError || !data)` linhas 58–78)

Hoje o bloco só mostra "Tentar novamente". Se a edge falha de verdade, não existe registro recente em `sga_situacao_check` e o backend bloqueia com 409 `inadimplencia_sga_pendente`. Vou adicionar:

- Botão "Ignorar e Prosseguir" (`KeyRound`) ao lado de "Tentar novamente"
- Reutiliza o mesmo `Dialog` de motivo já existente (extrair em variável compartilhada para não duplicar o JSX entre os três estados que abrem o bypass)
- O `onSuccess` do bypass espelha em `cotacao_avisos_sga` com `detalhes.origem_resultado: 'erro_consulta_sga'` para diferenciar dos outros casos na auditoria
- Texto curto do card: "Não foi possível consultar o SGA. Tente novamente ou prossiga sob sua responsabilidade — a ação será registrada."

**2. Esconder bypass para quem não tem permissão**

Usar `usePermissions().hasPermission('cadastro.bypass_inadimplencia_sga')` (a permissão já é checada pela edge na linha 132). Quando `false`, o botão "Ignorar e Prosseguir" não é renderizado em nenhum dos três estados (INCONCLUSIVO, INADIMPLENTE, erro). O `RefreshCw`/Consultar SGA novamente continua visível para todos.

A edge `verificar-situacao-financeira-cadastro` já valida e retorna 403 `sem_permissao_bypass` — a UI só evita mostrar um botão que daria erro.

## Detalhes técnicos

- Verificar se `hasPermission` aceita a chave `'cadastro.bypass_inadimplencia_sga'`; se a chave não estiver tipada no `PermissionKey`, usar a RPC `has_permission` via hook leve ou cast `as PermissionKey` consistente com o resto do projeto (confirmar lendo o `PermissionKey` antes do edit).
- Extrair o `<Dialog>` de bypass em uma constante JSX local dentro do componente (parametrizada por `origem_resultado` para a auditoria) para não triplicar o bloco.
- Nenhuma mudança no backend, edge functions, migrations ou no `aprovar-proposta`. Mudança puramente de UI.
- Sem mudança em `ModalDetalhesTroca.tsx` — herda automaticamente porque consome o mesmo componente.

## Verificação

- Build TypeScript passa
- Render manual mental dos 4 estados: loading, erro (NOVO bypass), inconclusivo (bypass), inadimplente (bypass), OK
- Para usuário sem permissão: botão de bypass não aparece em nenhum estado
