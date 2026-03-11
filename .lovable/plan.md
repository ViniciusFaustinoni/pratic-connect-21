

# Persistência em Tempo Real do Processo de Instalação

## Diagnóstico

Analisei o fluxo completo: `useTarefaAtual` → RPC `buscar_tarefa_atual_profissional` → `InstaladorChecklist`.

**Dois problemas encontrados:**

1. **A etapa atual (`etapaAtual`) vive apenas no React state** — não existe coluna `etapa_atual` na tabela `servicos`. Ao recarregar, sempre volta para etapa 1.

2. **O checklist só é salvo ao clicar "Avançar" da etapa 2 para a 3** (`salvarEAvancar`). Se o app for fechado durante o preenchimento, as alterações do checklist são perdidas.

3. **A tarefa em si (assignment no DB) persiste corretamente** — a RPC busca `status IN ('em_rota', 'em_andamento', 'agendada')` sem filtro de data. A percepção de "sumir" vem do fato de que todo progresso se perde e a experiência reinicia do zero.

## Plano

### 1. Migração: adicionar `etapa_atual` na tabela `servicos`
```sql
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS etapa_atual INTEGER DEFAULT 1;
```

### 2. Auto-save do checklist com debounce (InstaladorChecklist.tsx)
- Criar um `useEffect` com debounce (2s) que observa `checklist` e `quilometragem`.
- A cada mudança, salva automaticamente `checklist_data`, `quilometragem` e `etapa_atual` no DB via `useSalvarChecklistServico`.
- Garante que nenhum progresso é perdido mesmo que o app feche abruptamente.

### 3. Persistir `etapa_atual` ao avançar/voltar etapas
- No `salvarEAvancar` e ao mudar etapa, atualizar `etapa_atual` no DB.
- No `useEffect` de restauração (linhas 251-264), também restaurar `etapaAtual` do campo `servico.etapa_atual`.

### 4. Atualizar `useSalvarChecklistServico` para incluir `etapa_atual`
- Adicionar o campo `etapa_atual` ao mutation existente em `useServicos.ts`.

### 5. Atualizar a RPC `buscar_tarefa_atual_profissional` para retornar `etapa_atual`
- Incluir `s.etapa_atual` no SELECT e no RETURNS TABLE da função.
- O hook `useTarefaAtual` passa a expor esse campo.

## Arquivos modificados
- **Nova migração SQL** — adicionar coluna `etapa_atual`
- **Nova migração SQL** — atualizar RPC `buscar_tarefa_atual_profissional`
- `src/pages/instalador/InstaladorChecklist.tsx` — auto-save com debounce + restaurar etapa
- `src/hooks/useServicos.ts` — incluir `etapa_atual` no mutation
- `src/hooks/useTarefaAtual.ts` — expor `etapa_atual` no tipo

