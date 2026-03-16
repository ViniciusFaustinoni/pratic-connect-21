

## Plano: Corrigir erros que causam tela em branco na cotação

### Problema 1 — API de placas inacessível (NÃO é bug de código)

A API `placas.fipeapi.com.br` recusa conexões do Supabase Edge Functions. Isso é uma limitação de infraestrutura — a API bloqueia os IPs do Deno Deploy/Supabase.

**Ação:** Melhorar o tratamento de erro no `plate-lookup` para retornar uma mensagem amigável e garantir que a UI não quebre. Opcionalmente, considerar uma API alternativa de consulta de placas.

### Problema 2 — Foreign key inválida em useVerificarPlaca (CAUSA da tela em branco)

O hook `useVerificarPlaca.ts` faz uma query com hint `cotacoes_vendedor_id_fkey`:

```typescript
.select(`
  id, numero, vendedor_id, created_at, status,
  vendedor:profiles!cotacoes_vendedor_id_fkey(id, nome)
`)
```

O Supabase retorna erro PGRST200 porque essa foreign key não existe no schema cache. Isso causa um erro não tratado que pode resultar em tela em branco.

**Correção em `src/hooks/useVerificarPlaca.ts`:**
- Remover o hint explícito `!cotacoes_vendedor_id_fkey` e deixar o Supabase inferir a relação, ou
- Separar a query: buscar cotação primeiro, depois buscar o perfil do vendedor com uma segunda query
- Garantir que o erro não propague para a UI

### Resultado esperado
- Consulta de placa mostra mensagem amigável quando API está fora ("Serviço de consulta de placas indisponível. Preencha os dados manualmente.")
- Verificação de placa duplicada não causa crash mesmo sem a FK
- Tela de cotação não fica em branco

