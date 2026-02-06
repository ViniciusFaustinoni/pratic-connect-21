
# Plano: Corrigir Atualização de Status do Associado na Página do Cliente

## Problema Identificado

O cliente permanece na tela "Em Análise Cadastral" mesmo depois que o analista aprovou o cadastro e o associado já está com status `ativo`. O redirecionamento para `/acompanhar/:token` não está acontecendo.

## Causa Raiz

1. **Realtime com limitações de RLS**: O canal realtime usa `publicSupabase` (role anon) para escutar a tabela `associados`, mas a RLS dessa tabela provavelmente não permite que requisições anônimas vejam os registros diretamente

2. **Query stale**: A query `contrato-publico-fallback` que fornece o `associadoStatus` só é invalidada pelo realtime (que pode não estar funcionando) ou a cada 30 segundos via `refetchInterval`

3. **Sem fallback robusto**: Se o realtime falhar, o cliente fica esperando 30 segundos para ver a mudança

## Solução Proposta

Implementar duas correções para garantir a atualização imediata:

### 1. Adicionar subscrição realtime na tabela `contratos` (mais confiável)

A tabela `contratos` tem RLS que permite leitura pública via `cotacao_token_publico`. Podemos escutar mudanças nessa tabela como proxy para detectar quando o associado foi processado.

### 2. Reduzir intervalo de refetch e adicionar refetch no foco

Como fallback, reduzir o `refetchInterval` de 30s para 10s e adicionar `refetchOnWindowFocus: true` para garantir atualização quando o cliente volta à aba.

### 3. Adicionar log de debug para rastrear o problema

Adicionar console.log para verificar se o realtime está funcionando e quais valores estão sendo recebidos.

## Arquivos a Modificar

### `src/hooks/useCotacaoContratacao.ts`

1. **Reduzir `refetchInterval`** de 30000ms para 10000ms na query `contrato-publico-fallback`
2. **Adicionar `refetchOnWindowFocus: true`** para revalidar quando o cliente voltar à aba
3. **Melhorar o handler do realtime** para forçar refetch imediato das queries dependentes
4. **Adicionar log de debug** para identificar se o realtime está funcionando

```text
// ANTES (linhas 143-145)
refetchInterval: 30000,

// DEPOIS
refetchInterval: 10000, // Reduzido para 10 segundos
refetchOnWindowFocus: true, // Revalidar ao voltar para a aba
staleTime: 0, // Sempre considerar stale para garantir dados frescos
```

### Handler do realtime (linhas 249-263):

```text
// Melhorar invalidação para forçar refetch imediato
channel = channel.on(
  'postgres_changes',
  {
    event: 'UPDATE',
    schema: 'public',
    table: 'associados',
    filter: `id=eq.${associadoId}`,
  },
  async (payload) => {
    console.log('[CotacaoContratacao] Realtime: associado atualizado:', payload);
    
    // Forçar refetch imediato (não apenas invalidar)
    await queryClient.refetchQueries({ queryKey: ['contrato-publico-fallback', token] });
    refetch();
  }
);
```

### `src/pages/public/CotacaoContratacao.tsx`

1. **Adicionar log para debugging** no useEffect de redirecionamento
2. **Garantir que o redirecionamento aconteça** assim que os dados forem atualizados

## Impacto

- O cliente verá a mudança de status em até 10 segundos (ao invés de 30)
- Ao voltar para a aba, a atualização será imediata
- O realtime continuará tentando funcionar como melhoria adicional
- Logs de debug ajudarão a identificar se há problemas de RLS no realtime

## Fluxo Corrigido

```text
1. Analista aprova o associado → status muda para 'ativo'
2. Realtime dispara evento (se RLS permitir)
   OU refetchInterval detecta a mudança em até 10s
   OU usuário volta à aba e refetchOnWindowFocus atualiza
3. Query contrato-publico-fallback é refetchada
4. associadoStatus atualiza para 'ativo'
5. useEffect detecta mudança e redireciona para /acompanhar/:token
```

## Testes Recomendados

1. Aprovar um associado e verificar se o cliente é redirecionado
2. Verificar os console.logs para confirmar se o realtime está funcionando
3. Testar o refetch ao voltar para a aba do navegador
