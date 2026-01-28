

# Plano: Exclusão Cascata de Cotações para Diretores

## Problema Identificado

Ao tentar excluir cotações finalizadas, o sistema exibe: **"Erro ao excluir cotação. Verifique se há registros dependentes."**

### Causa Técnica

O hook `useExcluirCotacao` atual (linhas 402-494 de `useCotacoes.ts`) não trata todas as dependências:

| Tabela | Ação DELETE | Tratada? |
|--------|-------------|----------|
| `agendamentos_base` | NO ACTION ⚠️ | ❌ **Bloqueia** |
| `servicos` | SET NULL | ❌ Precisa limpar |
| `contratos` | SET NULL | ✅ |
| `contratos_documentos` | SET NULL | ❌ Precisa limpar via contrato |
| `cotacoes_historico` | CASCADE | ✅ Auto |
| `cotacoes_vistoria_fotos` | CASCADE | ✅ Auto |
| `instalacoes` | CASCADE | ✅ Auto |
| `vistorias` | CASCADE | ✅ Auto |
| `leads` | SET NULL | ✅ |

A FK `agendamentos_base.cotacao_id` tem `NO ACTION`, bloqueando a exclusão.

## Solução

Criar uma Edge Function `delete-cotacao` que:
1. Verifica se o usuário é diretor
2. Exclui todas as dependências em ordem correta usando `service_role`
3. Registra log de auditoria

### Arquitetura

```text
┌─────────────────────────┐
│ Diretor clica "Excluir" │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Edge Function           │
│ delete-cotacao          │
│                         │
│ 1. Verifica role=diretor│
│ 2. Usa service_role     │
│ 3. Exclui dependências: │
│    - agendamentos_base  │
│    - servicos           │
│    - contratos_docs     │
│    - contratos          │
│    - leads (null FK)    │
│    - cotacao            │
│ 4. Registra log         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Toast: "Cotação         │
│ excluída com sucesso!"  │
└─────────────────────────┘
```

## Implementação

### 1. Criar Edge Function `delete-cotacao`

**Arquivo:** `supabase/functions/delete-cotacao/index.ts`

```typescript
// Verificar role = diretor
// Usar service_role para bypass RLS
// Ordem de exclusão:
// 1. agendamentos_base (cotacao_id)
// 2. cotacoes_historico (cascade automático, mas garantir)
// 3. cotacoes_vistoria_fotos (cascade automático)
// 4. servicos (SET NULL cotacao_id)
// 5. Para cada contrato:
//    - contratos_documentos
//    - contratos_historico
//    - instalacoes (via contrato_id)
//    - vistorias (via contrato_id)
//    - asaas_cobrancas
//    - contrato
// 6. vistorias (cotacao_id - cascade, mas garantir)
// 7. instalacoes (cotacao_id - cascade, mas garantir)
// 8. leads (SET NULL cotacao_id)
// 9. cotacao
// 10. Registrar log de auditoria
```

### 2. Atualizar Hook `useExcluirCotacao`

**Arquivo:** `src/hooks/useCotacoes.ts`

Substituir a lógica atual por chamada à Edge Function:

```typescript
export function useExcluirCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (cotacaoId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-cotacao', {
        body: { cotacaoId },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      // Invalidar todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      // ... etc
      toast.success('Cotação excluída com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao excluir cotação:', error);
      toast.error(error.message || 'Erro ao excluir cotação');
    },
  });
}
```

### 3. Restringir Exclusão a Diretores

**Arquivo:** `src/components/cotacoes/CotacaoAcoes.tsx`

Adicionar verificação de role:

```typescript
interface CotacaoAcoesProps {
  // ... existentes
  canDelete?: boolean; // NOVO - apenas diretores
}

// No componente, mostrar botão Excluir apenas se canDelete
{canDelete && (
  <AlertDialog>
    {/* botão excluir */}
  </AlertDialog>
)}
```

**Arquivo:** `src/pages/vendas/CotacaoDetalhe.tsx`

Passar prop `canDelete`:

```typescript
const { roles } = useAuth();
const isDiretor = roles?.includes('diretor');

<CotacaoAcoes
  // ... props existentes
  canDelete={isDiretor}
/>
```

### 4. Atualizar Lista de Cotações

**Arquivo:** `src/pages/vendas/Cotacoes.tsx`

Verificar role antes de exibir opção de exclusão no dropdown.

## Segurança

| Verificação | Implementação |
|-------------|---------------|
| Autenticação | Edge Function valida token JWT |
| Autorização | Verifica role `diretor` via `user_roles` |
| Bypass RLS | Usa `SUPABASE_SERVICE_ROLE_KEY` |
| Auditoria | Registra em `auth_logs` |

## Alterações de Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/delete-cotacao/index.ts` | **Criar** - Edge Function para exclusão cascata |
| `src/hooks/useCotacoes.ts` | Atualizar `useExcluirCotacao` para chamar Edge Function |
| `src/components/cotacoes/CotacaoAcoes.tsx` | Adicionar prop `canDelete` |
| `src/pages/vendas/CotacaoDetalhe.tsx` | Passar `canDelete` baseado em role |
| `src/pages/vendas/Cotacoes.tsx` | Verificar role antes de exibir opção excluir |

## Resultado Esperado

1. Diretor acessa cotação finalizada com contrato assinado ✅
2. Botão "Excluir Cotação" visível apenas para diretores ✅
3. Confirma exclusão ✅
4. Edge Function remove: agendamentos_base, contratos, docs, etc ✅
5. Toast: "Cotação excluída com sucesso!" ✅
6. Log de auditoria registrado ✅

