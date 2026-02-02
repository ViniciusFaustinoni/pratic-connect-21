
# Plano: Corrigir Cache de Instalações Após Exclusão de Associado

## Problema Identificado

O associado "MARCUS VINICIUS FAUSTINONI DE FREITAS" foi excluído corretamente pelo diretor (confirmado via banco de dados - não há dados órfãos), porém ele ainda aparece na seção "Instalações Aguardando Ativação de Rastreador" porque o **cache do React Query não foi invalidado**.

## Diagnóstico

O hook `useDeleteAssociado` invalida as seguintes queries após exclusão:
```
- ['associados']
- ['associados-contagem']
- ['associados-cidades']
- ['associado']
```

**Mas não invalida:**
```
- ['instalacoes-aguardando-ativacao'] ← FALTANDO
- ['instalacoes']
- ['veiculos']
- ['propostas-pendentes']
- ['proposta-stats']
```

Como a exclusão do associado também remove instalações e veículos vinculados (via edge function), essas queries também precisam ser invalidadas.

---

## Solução

Adicionar invalidação das queries relacionadas no `onSuccess` do hook `useDeleteAssociado`.

### Alteração no arquivo `src/hooks/useAssociados.ts`

Localização: função `useDeleteAssociado()` → bloco `onSuccess`

Adicionar as seguintes invalidações:
```typescript
onSuccess: (result) => {
  // Invalidar associados
  queryClient.invalidateQueries({ queryKey: ['associados'] });
  queryClient.invalidateQueries({ queryKey: ['associados-contagem'] });
  queryClient.invalidateQueries({ queryKey: ['associados-cidades'] });
  queryClient.invalidateQueries({ queryKey: ['associado'] });
  
  // NOVO: Invalidar instalações e veículos (excluídos junto com associado)
  queryClient.invalidateQueries({ queryKey: ['instalacoes-aguardando-ativacao'] });
  queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
  queryClient.invalidateQueries({ queryKey: ['veiculos'] });
  
  // NOVO: Invalidar propostas pendentes (UI atualizada)
  queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
  queryClient.invalidateQueries({ queryKey: ['proposta-stats'] });
  
  toast.success(result.message || 'Associado excluído permanentemente');
},
```

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useAssociados.ts` | Adicionar invalidações no `onSuccess` de `useDeleteAssociado` |

---

## Resultado Esperado

Após a exclusão de um associado pelo diretor:

1. Os dados são removidos do banco (já funciona)
2. A seção "Instalações Aguardando Ativação" atualiza automaticamente (será corrigido)
3. A lista de propostas pendentes atualiza automaticamente (será corrigido)
4. Nenhum dado "fantasma" aparece na interface
