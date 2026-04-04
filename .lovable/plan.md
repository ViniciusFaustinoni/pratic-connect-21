

# Corrigir limite de 1000 registros nas métricas de rastreadores

## Problema
O hook `useRastreadoresMetricas` em `src/hooks/useRastreadores.ts` faz `supabase.from('rastreadores').select('status, ultima_comunicacao')` sem paginação. O Supabase retorna no máximo 1000 linhas por padrão, então com 1000+ rastreadores, as métricas ficam truncadas (mostra "1000 cadastrados" em vez do total real, e contagens de online/offline incorretas).

## Solução
Substituir a query que busca todas as linhas por **queries paralelas com `count: 'exact', head: true`** para cada status, similar ao padrão já usado no projeto (`PageHeader.tsx`).

Para as métricas de comunicação (online/offline/atenção), que dependem de `ultima_comunicacao`, usar **fetch recursivo com `.range()`** para buscar todos os rastreadores instalados (ou uma RPC/view se disponível).

### Abordagem concreta em `src/hooks/useRastreadores.ts`:

1. **Contagens por status** — usar `{ count: 'exact', head: true }` em paralelo:
   - `total`: count sem filtro
   - `estoque`: `.eq('status', 'estoque')`
   - `instalados`: `.eq('status', 'instalado')`
   - `manutencao`: `.eq('status', 'manutencao')`
   - `baixados`: `.eq('status', 'baixado')`

2. **Online/Offline/Atenção** — buscar apenas rastreadores instalados com `ultima_comunicacao` usando fetch recursivo com `.range()` (somente `ultima_comunicacao` é necessário, payload leve). Loop em páginas de 1000 até esgotar.

3. Classificar cada rastreador instalado com a função `isRastreadorOnline` existente.

## Arquivo alterado
| Arquivo | Ação |
|---------|------|
| `src/hooks/useRastreadores.ts` | Reescrever `useRastreadoresMetricas` com contagens paralelas + fetch paginado |

