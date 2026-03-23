

# Plano: Corrigir nomes dos perfis para exibição da Grade de Comissão

## Problema

O código em `UsuarioForm.tsx` verifica os roles `consultor_interno` e `consultor_externo`, mas esses roles **não existem** no banco. Os roles corretos são:

| No código (errado) | No banco (correto) |
|---|---|
| `consultor_interno` | `vendedor_clt` |
| `consultor_externo` | `vendedor_externo` |
| `agencia` | `agencia` ✅ |

Por isso o card "Grade de Comissão" nunca aparece para vendedores.

## Correção

**Arquivo**: `src/pages/configuracoes/UsuarioForm.tsx` — duas ocorrências (linhas 416 e 644)

Substituir:
```typescript
['consultor_interno', 'consultor_externo', 'agencia']
```

Por:
```typescript
['vendedor_clt', 'vendedor_externo', 'agencia']
```

Nenhuma outra alteração necessária.

