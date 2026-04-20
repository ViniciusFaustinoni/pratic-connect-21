

## Regra de integridade: instalações não podem ser excluídas

Remover toda capacidade de **DELETE** sobre `instalacoes` originada do módulo de Monitoramento. Registros permanecem para sempre; só o `status` evolui (`agendada → em_rota → em_andamento → concluida` ou laterais `reagendada / cancelada / nao_compareceu / em_analise`).

### Diagnóstico — onde existe DELETE hoje

| # | Local | Ação atual | Decisão |
|---|---|---|---|
| 1 | `src/pages/monitoramento/InstalacoesList.tsx` (linhas 360-374, 409-433) | Item "Excluir" no DropdownMenu + `AlertDialog` chamando `deleteInstalacao.mutate` para instalações canceladas | **Remover** botão, dialog, estados (`deleteDialogOpen`, `instalacaoToDelete`) e import |
| 2 | `src/components/instalacoes/InstalacaoDetailDrawer.tsx` (linhas 188-198, 637-666) | Botão "Excluir" no rodapé do drawer quando status = `cancelada` | **Remover** botão, `handleDelete`, `confirmDeleteOpen`, import de `useDeleteInstalacao` |
| 3 | `src/hooks/useInstalacoes.ts` (linhas 803-824) | Hook `useDeleteInstalacao` faz `.from('instalacoes').delete()` | **Remover** o hook por completo (nenhum outro consumidor após 1 e 2) |
| 4 | `supabase/functions/delete-ativacao/index.ts` e `delete-associado/index.ts` | DELETE em cascata ao excluir associado/ativação inteira (fluxo administrativo de outro módulo, não de Monitoramento) | **Manter intacto** — escopo diferente |

### Defesa em profundidade no banco

Adicionar policy de RLS **restritiva** que nega `DELETE` em `instalacoes` para qualquer usuário autenticado (inclusive Diretor), garantindo que nem chamadas diretas via SDK nem inspeções futuras consigam apagar:

```sql
CREATE POLICY "instalacoes_no_delete"
ON public.instalacoes
AS RESTRICTIVE
FOR DELETE
TO authenticated, anon
USING (false);
```

Isso preserva os DELETEs feitos pelas edge functions `delete-ativacao` e `delete-associado` porque ambas usam `service_role` (bypass RLS) — fluxo de exclusão de associado inteiro continua funcionando.

### Substituição na UX

Onde existia "Excluir", o coordenador continua tendo:
- **Cancelar** (já existe) — muda status para `cancelada`.
- **Reagendar** (já existe) — muda status para `reagendada`.
- **Marcar como Não Compareceu** — adicionar item no DropdownMenu da lista e botão no drawer (status `nao_compareceu` já existe no enum) usando o `useUpdateInstalacaoStatus` já existente. Disponível para status `agendada`, `em_rota`, `em_andamento`.

Assim a lista mantém todos os registros históricos e o coordenador navega o ciclo de vida sem nunca apagar dados.

### Validação após deploy

1. Lista `/monitoramento/instalacoes` → instalação cancelada → DropdownMenu não mostra mais "Excluir", apenas "Ver detalhes" e "Marcar como Não Compareceu" (quando aplicável).
2. Drawer de detalhes de uma instalação cancelada → não há botão "Excluir".
3. Tentativa direta via console: `supabase.from('instalacoes').delete().eq('id', '<id>')` → retorna erro de RLS.
4. Excluir um associado pelo fluxo administrativo (`delete-associado` edge function) → continua removendo as instalações dele em cascata (service_role bypassa RLS).
5. Histórico do associado mostra todas as instalações antigas (concluídas, canceladas, não compareceu, reagendadas).

### Arquivos tocados

- `src/pages/monitoramento/InstalacoesList.tsx` — remover botão/dialog/estados de Excluir; adicionar item "Marcar como Não Compareceu".
- `src/components/instalacoes/InstalacaoDetailDrawer.tsx` — remover botão/dialog/handler de Excluir; adicionar botão "Não Compareceu" para status em andamento.
- `src/hooks/useInstalacoes.ts` — remover `useDeleteInstalacao`.
- **Migração SQL** — policy restritiva `instalacoes_no_delete`.

Sem mudança de schema (enum `status_instalacao` já contém `nao_compareceu`). Sem nova dependência. Edge functions de exclusão de associado/ativação permanecem intocadas.

