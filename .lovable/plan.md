## Diagnóstico

O serviço **NÃO está pendente no banco**. Foi cancelado às **12:23 (hora local) de hoje (27/04)** pelo próprio admin, com observação:

> *"LIBERADO PELO ADMIN: FEITO NA LOTUS DIA 23/04/2026 — FOTOS FEITAS NO VISTO"*

Os 3 serviços de instalação da placa **KPD8B52** (Hillary dos Prazeres) estão com status:

| ID | Data | Status | Atualizado |
|---|---|---|---|
| e463ecbd… | 27/04 | `cancelada` | 27/04 15:23 |
| 973f9542… | 25/04 | `cancelada` | 27/04 13:38 |
| 707399fd… | 25/04 | `nao_compareceu` | 25/04 15:15 |

Como o hook `useServicosParaAtribuir` só lista `status IN ('pendente','agendada')` com `data_agendada >= hoje`, esse serviço **não deveria aparecer**.

## Causa raiz

O hook `useServicosParaAtribuir` está configurado com:
- `refetchInterval: 30000` (30s)
- `refetchIntervalInBackground: false` ← **não atualiza quando a aba está em segundo plano**
- Sem `refetchOnWindowFocus`

Quando o usuário abre a aba (ou ela ficou em background), os dados ficam **defasados** até o próximo refetch — mostrando o serviço como pendente mesmo após o cancelamento.

## Correção proposta

Em `src/hooks/useAtribuicaoManual.ts`, no hook `useServicosParaAtribuir`:
- Reduzir `refetchInterval` de **30s → 15s**
- Habilitar `refetchIntervalInBackground: true` (mapa de monitoramento é tela operacional crítica)
- Adicionar `refetchOnWindowFocus: true` para recarregar imediatamente ao voltar para a aba
- Adicionar `staleTime: 0` para garantir leitura sempre fresca

Mesma correção aplicada também em `useTecnicosAtivosParaAtribuir` (linha ~280) para manter consistência das tarefas atribuídas a cada técnico.

## Resultado esperado

Assim que o serviço for cancelado/finalizado, a coluna "Serviços Pendentes" remove o card em ≤ 15s (ou imediatamente ao focar a aba), sem precisar recarregar a página manualmente.

## Arquivos afetados

- `src/hooks/useAtribuicaoManual.ts` (2 hooks: `useServicosParaAtribuir` e `useTecnicosAtivosParaAtribuir`)
