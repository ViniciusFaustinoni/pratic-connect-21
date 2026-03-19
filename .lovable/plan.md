

# Botões Aprovar/Rejeitar na Aba Titularidade

## Resumo
Adicionar botões de Aprovar e Rejeitar nos cards de solicitação pendente da aba Titularidade em Processos Operacionais, com controle de permissão e feedback visual após ação.

## O que já existe
- Edge function `aprovar-solicitacao-ia` já processa tanto `aprovar` quanto `rejeitar` para `troca_titularidade`
- A função já verifica roles (diretor, admin_master, desenvolvedor, analista_eventos)
- Cenário A/B é determinado automaticamente com base nas configurações
- O protocolo retornado contém `TRC-DISP-` (cenário A) ou `TRC-` (cenário B)
- Rejeição já salva `motivo_rejeicao` no banco

## Alterações

### 1. Edge function `aprovar-solicitacao-ia` — retorno enriquecido (pequena mudança)
No bloco de troca_titularidade, adicionar campo `cenario` na resposta para que o frontend saiba se foi A ou B:
```
// No return final da função (linha ~860), incluir:
cenario: cenarioA ? 'A' : 'B'
```
Também adicionar `gerente` à lista de roles permitidos (linha 74) para que gerentes possam aprovar.

### 2. `src/pages/cadastro/ProcessosOperacionais.tsx` — TrocaTitularidadeTab

**Novos imports**: `usePermissions`, `useMutation`, `useQueryClient`, `AlertDialog`, `Textarea`, `CheckCircle`, `XCircle`, `Loader2`

**Permissão**: Usar `usePermissions()` para checar `isGerencia` (que inclui gerente, diretor, admin_master) — botões só aparecem se `isGerencia === true` e `sol.status === 'pendente'`.

**Mutation de aprovação**: Chamar `supabase.functions.invoke('aprovar-solicitacao-ia', { body: { solicitacao_id, acao: 'aprovar' } })`. Após sucesso, invalidar query `processos-troca-titularidade` e `processos-counts`.

**Mutation de rejeição**: Mesma edge function com `acao: 'rejeitar'` e `motivo` obrigatório.

**UI dos botões**: Ao lado do "Ver Ficha", adicionar:
- Botão verde "Aprovar" com ícone CheckCircle — abre AlertDialog de confirmação simples
- Botão vermelho "Rejeitar" com ícone XCircle — abre Dialog com campo Textarea obrigatório para motivo

**Resultado pós-aprovação**: Após aprovação, exibir badge no card indicando:
- Cenário A: "Vistoria dispensada" (badge verde)
- Cenário B: "Vistoria agendada" (badge azul)

Essa info será lida do campo `resultado_id` e `dados` do registro atualizado (o card já recarrega via invalidação de query).

**Resultado pós-rejeição**: Badge "Rejeitado" (já existe) + exibir motivo da rejeição abaixo dos dados.

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/cadastro/ProcessosOperacionais.tsx` | Botões Aprovar/Rejeitar, dialogs de confirmação, mutations, permissão |
| `supabase/functions/aprovar-solicitacao-ia/index.ts` | Retornar `cenario` na resposta + adicionar `gerente` aos roles permitidos |

