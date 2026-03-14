

# Configurações de Comissionamento Externo

## Localização e Acesso

Nova rota: `/financeiro/configuracoes/comissionamento-externo`
Acesso: Diretor e Admin Financeiro (verificado via `usePermissions`)

## Armazenamento

Usa a tabela `configuracoes` existente com as seguintes chaves:

| Chave | Tipo | Default |
|---|---|---|
| `comissao_ext_pct_adesao` | número | 100 |
| `comissao_ext_msg_adesao_zero` | texto | "" |
| `comissao_ext_valor_volante` | número | 50 |
| `comissao_ext_tipo_recorrente` | texto ("fixo" ou "percentual") | "percentual" |
| `comissao_ext_valor_recorrente` | número | 0 |
| `comissao_ext_parcelas_recorrente` | número | 6 |

Sem migration necessária — a tabela `configuracoes` aceita qualquer chave/valor. Será feito upsert das chaves na primeira carga.

## Arquivos

### 1. `src/pages/financeiro/ComissionamentoExternoConfig.tsx` (novo)
Página com 3 cards verticais, cada um com formulário e botão "Salvar" independente:

- **Card 1 — Comissão de Adesão**: campo % (0-100), textarea para mensagem (max 300 chars com contador), validação inline
- **Card 2 — Custo Instalação Volante**: campo R$ com resumo dinâmico abaixo
- **Card 3 — Comissão Recorrente**: select tipo (fixo/percentual), campo valor dinâmico, campo parcelas, simulador em tempo real

Aviso fixo no topo (AlertTriangle): "Alterações nestas configurações se aplicam apenas a novas vendas..."

Padrão de save: mesmo do `RateioConfig.tsx` — `supabase.from('configuracoes').update()` + POST em `configuracoes_historico`

### 2. `src/hooks/useComissaoExternaConfig.ts` (novo)
Hook que busca as 6 chaves de uma vez, retorna valores tipados e mutation de save por chave (com toast e invalidação).

### 3. `src/App.tsx`
Adicionar rota `/financeiro/configuracoes/comissionamento-externo` com `ProtectedRoute` (allowedRoles diretor/admin financeiro).

### 4. Navegação
Adicionar link no menu financeiro (sidebar ou dashboard) apontando para a nova rota.

## Inserção de defaults

Ao carregar, se uma chave não existir, o hook usa o valor padrão (sem criar registro). Ao salvar pela primeira vez, se o registro não existir, faz upsert.

