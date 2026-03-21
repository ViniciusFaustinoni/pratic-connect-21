

# Plano: Criar seção "Grades de Comissão" nas Configurações

## Resumo

Nova aba "Grades de Comissão" nas Configurações, visível apenas para Diretor e Admin. Permite criar, editar, duplicar, ativar/inativar e excluir grades de comissão com níveis percentuais que não podem ultrapassar 100% da taxa de adesão.

## 1. Banco de Dados (SQL Migration)

Criar tabela `grades_comissao`:
- `id` UUID PK
- `nome` TEXT NOT NULL
- `descricao` TEXT nullable
- `ativo` BOOLEAN DEFAULT true
- `created_by` UUID references auth.users
- `created_at`, `updated_at` TIMESTAMPTZ

Criar tabela `grades_comissao_niveis`:
- `id` UUID PK
- `grade_id` UUID references grades_comissao ON DELETE CASCADE
- `nome` TEXT NOT NULL (ex: "Vendedor Externo")
- `percentual` NUMERIC NOT NULL
- `ordem` INTEGER NOT NULL
- `created_at` TIMESTAMPTZ

RLS: leitura para authenticated, escrita restrita via `has_role` para Diretor/Admin Master.

## 2. Nova Página: `src/pages/configuracoes/GradesComissao.tsx`

Lista de grades com:
- Cards/tabela: nome, qtd níveis, soma percentuais, status (badge Ativa/Inativa)
- Ações: Editar, Duplicar, Ativar/Inativar, Excluir (desabilitado se em uso)
- Botão "+ Nova Grade de Comissão" no topo

## 3. Nova Página/Modal: `src/pages/configuracoes/GradeComissaoForm.tsx`

Formulário com:
- Nome da grade, descrição opcional
- Seção "Níveis de Comissão" com botão "+ Adicionar Nível"
- Cada nível: nome (texto livre), percentual (%), botão remover, setas reordenar
- Barra de progresso em tempo real: "Total alocado: XX% de 100%"
- Validação: soma > 100% desabilita salvar com mensagem vermelha
- Soma < 100% permitida

## 4. Roteamento (`App.tsx`)

- Adicionar rota `/configuracoes/grades-comissao` → `GradesComissao`
- Adicionar rota `/configuracoes/grades-comissao/nova` e `/configuracoes/grades-comissao/:id` → `GradeComissaoForm`

## 5. Layout (`ConfiguracoesLayout.tsx`)

- Adicionar tab "Grades de Comissão" com ícone `Calculator`, flag `diretorOnly: true`
- Ajustar filtro: `diretorOnly` mostra para Diretor, Admin Master e Desenvolvedor

## 6. Exports (`src/pages/configuracoes/index.tsx`)

- Exportar os dois novos componentes

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| SQL (migração) | Criar tabelas `grades_comissao` e `grades_comissao_niveis` com RLS |
| `src/pages/configuracoes/GradesComissao.tsx` | **Novo** -- lista de grades |
| `src/pages/configuracoes/GradeComissaoForm.tsx` | **Novo** -- formulário criação/edição |
| `src/pages/configuracoes/ConfiguracoesLayout.tsx` | Adicionar tab "Grades de Comissão" |
| `src/pages/configuracoes/index.tsx` | Exportar novos componentes |
| `src/App.tsx` | Adicionar rotas |

