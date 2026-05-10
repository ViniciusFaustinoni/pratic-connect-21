# Badge de pendentes em "Processos" (Cadastro)

Hoje a sidebar já exibe badge dinâmico para **Biometrias Pendentes** e **Aprovações** (Monitoramento), via hooks dedicados injetados em `AppSidebar.tsx`. O item **Processos** (`/cadastro/processos`) ainda não tem badge, embora a página interna (`ProcessosOperacionais`) já calcule contadores por aba (Titularidade, Substituições, Migrações, Inclusões).

## O que será feito

1. **Novo hook `useProcessosOperacionaisCount`** (`src/hooks/useProcessosOperacionaisCount.ts`)
   - Reaproveita exatamente as mesmas 4 queries `count: 'exact', head: true` já usadas em `useProcessosCounts` dentro de `ProcessosOperacionais.tsx`:
     - `solicitacoes_troca_titularidade` em `aguardando_cadastro` ou `cotacao_em_andamento`
     - `substituicoes_veiculo` em `aguardando_aprovacao`
     - `solicitacoes_migracao` em `pendente`
     - `cotacoes` com `tipo_entrada=inclusao` e status `rascunho`/`enviada`
   - Retorna o **somatório** (total pendente global, sem filtro de escopo de vendedor — igual a `useBiometriasPendentesCount` e `useAprovacoesMonitoramentoCount`).
   - `staleTime: 30s`, `refetchOnWindowFocus: true` (mesmo padrão dos outros).

2. **Injetar o badge no `AppSidebar.tsx`**
   - Importar e chamar o novo hook ao lado de `useBiometriasPendentesCount` / `useAprovacoesMonitoramentoCount`.
   - No bloco "Injetar badges dinâmicos", adicionar:
     ```ts
     if (item.url === '/cadastro/processos' && processosCount > 0) {
       return { ...item, badge: String(processosCount) };
     }
     ```
   - Incluir `processosCount` no array de dependências do `useMemo`.

## Detalhes técnicos

- **Sem mudança de schema** — apenas leitura.
- **Sem mudança visual no item** — o badge já é renderizado pelo bloco existente que lê `item.badge` (linhas 887, 1031, 1095 de `AppSidebar.tsx`), portanto herdará o mesmo estilo dos demais.
- **Permissões** — o hook não filtra por papel; a renderização do item de menu já é gated pelas permissões existentes, então só usuários que enxergam "Processos" verão o badge.
- **Performance** — 4 HEAD queries paralelas, idêntico ao que a própria página já dispara ao abrir.

## Fora do escopo

- Não vamos refatorar o `useProcessosCounts` interno da página para reusar o novo hook (mantém escopo por vendedor, comportamento diferente).
- Não vamos adicionar badge ao `/juridico/processos` (item separado, contexto distinto). Se quiser depois, é pedir.
