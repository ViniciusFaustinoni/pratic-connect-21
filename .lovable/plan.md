

# Plano: Adicionar toggle Ativo/Desativado para cada configuração

## O que muda

Cada seção de configuração (Encaixe e Atribuicao Automatica) ganha um Switch no header do Card que liga/desliga a funcionalidade. Quando desativado, os campos ficam visualmente desabilitados (opacity reduzida, inputs disabled) mas a rota continua funcionando normalmente -- so a regra especifica deixa de ser aplicada.

## Implementacao

### 1. Migração SQL -- criar chaves de toggle na tabela `configuracoes`

Inserir duas novas linhas:
```sql
INSERT INTO configuracoes (chave, valor, descricao) VALUES
  ('operacional_encaixe_ativo', 'true', 'Habilita/desabilita o sistema de encaixe'),
  ('fila_atribuicao_ativa', 'true', 'Habilita/desabilita a atribuição automática de tarefas')
ON CONFLICT (chave) DO NOTHING;
```

### 2. `ConfiguracoesEncaixe.tsx`

- Importar `Switch` de `@/components/ui/switch`
- Adicionar estado `ativo` lido da configuracao (chave `operacional_encaixe_ativo`)
- No `useConfiguracoesEncaixe`, buscar tambem a chave `operacional_encaixe_ativo`
- No CardHeader, adicionar Switch ao lado do titulo: quando desligado, o CardContent inteiro fica com `opacity-50 pointer-events-none`
- Toggle persiste na tabela `configuracoes` via `useAtualizarConfiguracoesEncaixe`

### 3. `ConfiguracoesFilaAtribuicao.tsx`

- Mesmo padrao: importar Switch, buscar chave `fila_atribuicao_ativa`, adicionar toggle no header
- Quando desativado, campos ficam desabilitados visualmente

### 4. Consumidores -- respeitar o toggle

- No hook `useEncaixesDisponiveis` (que busca encaixes para o instalador), verificar se `operacional_encaixe_ativo = 'true'` antes de retornar resultados. Se falso, retorna lista vazia.
- Na Edge Function `cron-atribuir-tarefas` (ou hook equivalente que faz atribuicao), verificar se `fila_atribuicao_ativa = 'true'` antes de processar. Se falso, pula o processamento.

## Arquivos afetados

| Arquivo | Alteracao |
|---------|-----------|
| Migracao SQL | Inserir 2 chaves novas |
| `src/components/rotas/ConfiguracoesEncaixe.tsx` | Adicionar Switch ativo/desativado |
| `src/components/rotas/ConfiguracoesFilaAtribuicao.tsx` | Adicionar Switch ativo/desativado |
| `src/hooks/useEncaixesDisponiveis.ts` | Verificar toggle antes de retornar encaixes |
| Edge Function `cron-atribuir-tarefas` (se existir) | Verificar toggle antes de processar |

