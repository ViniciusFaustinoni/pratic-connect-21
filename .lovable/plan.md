

# Plano: Comissionamento por Plano (Configurações)

## Resumo

Nova aba "Comissionamento por Plano" nas Configurações, visível para Diretor/Admin. Permite configurar valor/percentual de comissão recorrente por plano e por nível de hierarquia (vindos das grades de comissão).

## 1. Banco de Dados (SQL Migration)

### Tabela `comissao_plano_nivel`
- `id` UUID PK
- `plano_id` UUID NOT NULL references `planos(id)`
- `nivel_nome` TEXT NOT NULL (ex: "Vendedor Externo" -- nome do nível da grade)
- `tipo_comissao` TEXT NOT NULL DEFAULT 'valor_fixo' ('valor_fixo' | 'percentual')
- `valor` NUMERIC NOT NULL DEFAULT 0
- `parcelas` INTEGER NOT NULL DEFAULT 0 (0 = não gera comissão)
- `ativo` BOOLEAN DEFAULT true
- `created_at`, `updated_at` TIMESTAMPTZ
- UNIQUE(`plano_id`, `nivel_nome`)

RLS: leitura para authenticated, escrita restrita a Diretor/Admin Master via `has_role`.

Trigger `updated_at` automático.

## 2. Nova Página: `src/pages/configuracoes/ComissionamentoPlano.tsx`

### Lista de planos
- Query `planos` ativos, exibe cards/tabela com nome do plano
- Para cada plano, mostra badge com quantidade de níveis configurados
- Ao clicar, abre configuração inline (accordion) ou navega para sub-página

### Configuração por plano (inline ou modal)
- Busca todos os nomes de níveis distintos de `grades_comissao_niveis` (SELECT DISTINCT nome)
- Para cada nível, exibe linha editável:
  - Nome do nível (read-only)
  - Select: Valor fixo (R$) / Percentual (%)
  - Input: valor ou percentual
  - Input: número de parcelas
  - Switch: ativo/inativo
- Botão "Salvar" faz upsert em `comissao_plano_nivel`
- Tabela visual clara conforme exemplo do usuário

## 3. Roteamento e Layout

### `ConfiguracoesLayout.tsx`
- Nova tab: `{ path: '/configuracoes/comissionamento-plano', label: 'Comissionamento por Plano', icon: Receipt, diretorOnly: true }`

### `App.tsx`
- Rota: `comissionamento-plano` dentro do grupo `configuracoes`

### `src/pages/configuracoes/index.tsx`
- Exportar `ComissionamentoPlano`

## 4. Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| SQL (migração) | Criar tabela `comissao_plano_nivel` com RLS |
| `src/pages/configuracoes/ComissionamentoPlano.tsx` | **Novo** -- lista de planos + configuração por nível |
| `src/pages/configuracoes/ConfiguracoesLayout.tsx` | Nova tab |
| `src/pages/configuracoes/index.tsx` | Export |
| `src/App.tsx` | Rota nova |

