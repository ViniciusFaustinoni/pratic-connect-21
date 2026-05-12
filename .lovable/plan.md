## Problema

O badge do item **Monitoramento › Aprovações** no sidebar (`useAprovacoesMonitoramentoCount`) hoje conta **apenas 2** das 6 abas existentes na tela `Aprovações do Monitoramento`:

- ✅ Ressalvas Pendentes
- ✅ Imprevistos
- ❌ Aprovação de Associados
- ❌ Troca de Titularidade
- ❌ Liberação de Suspensão
- ❌ Recusas do Instalador

Por isso o número exibido não corresponde ao volume real de itens aguardando ação.

## Correção proposta

Reescrever `src/hooks/useAprovacoesMonitoramentoCount.ts` para somar as 6 fontes, replicando os mesmos filtros usados pelos hooks de cada aba:

| Aba | Fonte | Filtro de "aguardando" |
|---|---|---|
| Aprovação de Associados | `servicos` | `tipo='instalacao'` + `status='concluida'` + (via join) `veiculos.cobertura_total != true` + `associados.status != 'ativo'` |
| Troca de Titularidade | `solicitacoes_troca_titularidade` | `status = 'aguardando_monitoramento'` |
| Liberação de Suspensão | `veiculos` | `cobertura_suspensa = true` ∩ contrato ativo/assinado com `liberado_reagendamento_em IS NULL` |
| Recusas do Instalador | `servicos` | `decisao_instalador='negado'` + `status='em_analise'` |
| Ressalvas Pendentes | `servicos` | `decisao_instalador='pendente_monitoramento'` + `status='em_analise'` (já existe) |
| Imprevistos | `servicos` | `status IN ('nao_compareceu','imprevisto_pendente')` + `reagendamento_followup_count >= 3` (já existe) |

Implementação:

1. Executar as 6 queries em `Promise.all`. As 4 que admitem `count: 'exact', head: true` pegam só o número; as 2 que precisam de join pós-filtro (Aprovação de Associados e Liberação de Suspensão) selecionam apenas as colunas mínimas necessárias e contam após o filtro em memória — replicando o que o hook da aba já faz.
2. Retornar a soma dos 6 contadores.
3. Manter `refetchInterval: 60_000` e `staleTime: 30_000`. Atualizar o `queryKey` para `['aprovacoes-monitoramento-count','v2']` para invalidar cache antigo.
4. Sem mudanças em `AppSidebar.tsx` — ele já injeta o badge a partir do hook (`linha 630-632`).

## Detalhes técnicos

- Arquivo único alterado: `src/hooks/useAprovacoesMonitoramentoCount.ts`.
- Tipos `any` quando necessário em joins (alinhado ao padrão dos hooks existentes).
- Erros silenciosos por fonte: se uma das queries falhar, contar 0 daquela fonte e logar `console.warn`, para não esconder o badge inteiro.

## Fora de escopo

- Não criar badges por aba.
- Não alterar páginas/abas, lógica de aprovação, edge functions ou permissões.
