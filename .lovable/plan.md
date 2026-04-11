

## Plano: Mover aprovação para Edge Function (eliminar lentidão)

### Diagnóstico

A função `useAprovarProposta` em `src/hooks/usePropostasPendentes.ts` (linhas 1257-1826) executa **~18 chamadas sequenciais ao banco/edge functions a partir do navegador do analista**. Cada chamada tem latência de rede (browser → Supabase → DB → browser), totalizando 10-30 segundos dependendo da conexão.

Operações sequenciais atuais:
1. Buscar contrato (select)
2. Verificar idempotência
3. Atualizar contrato → ativo (update)
4. Verificar instalação concluída (select)
5. Buscar veículo do contrato (select)
6. Verificar instalação ativa (select)
7. Atualizar associado → ativo (update)
8. Buscar valor_fipe do veículo (select)
9. Buscar configurações de rastreador (select)
10. Atualizar veículo (update)
11. Se instalação concluída: buscar rastreador + ativar plataforma + criar acesso + notificar (4 calls)
12. Se precisa instalação: buscar cotação + geocodificar + inserir instalação (3 calls)
13. Registrar histórico (insert)
14. Atualizar documentos (update)
15. Atualizar documentos_solicitados (update)
16. Atualizar contratos_documentos (update)
17. Buscar link_token (select)
18. SGA Hinova sync (invoke)

### Solução

Criar uma **edge function `aprovar-proposta`** que executa toda essa lógica **server-side** (latência DB ~1ms vs ~100ms do browser). O hook no frontend fará uma única chamada.

### Alterações

**1. Criar `supabase/functions/aprovar-proposta/index.ts`**
- Mover toda a lógica de `mutationFn` (linhas 1262-1826) para a edge function
- Receber `{ contrato_id, aprovado_por, veiculo_renavam?, veiculo_chassi? }` no body
- Usar `supabaseClient` com service role para evitar problemas de RLS
- Paralelizar queries independentes (ex: buscar veículo + verificar instalação ao mesmo tempo)
- Retornar `{ success, mensagem, jaAprovado? }`

**2. Simplificar `useAprovarProposta` no hook**
- Reduzir `mutationFn` a uma única chamada: `supabase.functions.invoke('aprovar-proposta', { body })`
- Manter `onSuccess` / `onError` existentes (toast, invalidação, navegação)

**3. Mover atualização de RENAVAM/CHASSI para dentro da edge function**
- O `handleConfirmarAprovacao` em `PropostaAnalise.tsx` (linhas 97-111) atualmente salva renavam/chassi antes de chamar `aprovarMutation`. Passar esses dados como parâmetros da edge function para eliminar outra round-trip.

### Ganho esperado

- **De ~15-30s para ~2-4s** (todas as queries executam com latência local no servidor Supabase)
- Queries independentes podem ser paralelizadas com `Promise.all`
- Edge functions rodam no mesmo datacenter que o banco

### Deploy

Deploy da edge function `aprovar-proposta` após criação.

