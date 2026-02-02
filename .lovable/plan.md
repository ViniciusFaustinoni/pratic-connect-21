
# Plano: Corrigir Tratamento de Erro na Criação de Conta

## Diagnóstico

### Situação do MARCUS VINICIUS:
- **Email**: `viniciusfaustinoni@gmail.com`
- **Associado ID**: `ee96a1d7-d591-4906-829a-168e25dbc49c` → `user_id = null`
- **Profile existente**: `user_id = 6f834291-b3c8-44e6-a96d-3c7a79fb50b5`
- **Role**: `associado` já atribuída

### Problema Técnico:
A Edge Function retorna corretamente `{ success: false, error: 'Este email já está em uso...' }` com status 400, mas o frontend não extrai essa mensagem corretamente.

Quando `functions.invoke` recebe um status não-2xx:
- `data` retorna `null`
- `error` é uma instância de `FunctionsHttpError`
- O corpo da resposta está em `error.context` (precisa ser lido com `.json()`)

O código atual (linha 61-64) interpreta isso como "erro de conexão" porque verifica apenas se há `error` sem `data`.

---

## Correções

### 1. Frontend: Tratamento correto do erro HTTP

**Arquivo:** `src/components/public/CriarContaAssociadoForm.tsx`

Importar tipos de erro do Supabase e extrair mensagem corretamente:

```typescript
import { FunctionsHttpError } from '@supabase/supabase-js';

// No try/catch:
const { data, error } = await supabase.functions.invoke('app-criar-conta-cliente', {...});

// Tratar erro HTTP da Edge Function
if (error) {
  if (error instanceof FunctionsHttpError) {
    // Extrair corpo da resposta de erro
    const errorData = await error.context.json();
    throw new Error(errorData.error || 'Erro ao criar conta');
  }
  // Erro de rede/conexão real
  throw new Error('Erro de conexão. Verifique sua internet e tente novamente.');
}

// Verificar sucesso
if (!data?.success) {
  throw new Error(data?.error || 'Resposta inválida do servidor.');
}
```

### 2. Banco de Dados: Vincular associado ao usuário existente

Executar SQL para corrigir o caso do MARCUS:

```sql
UPDATE associados 
SET user_id = '6f834291-b3c8-44e6-a96d-3c7a79fb50b5'
WHERE id = 'ee96a1d7-d591-4906-829a-168e25dbc49c'
  AND user_id IS NULL;
```

---

## Resumo de Mudanças

| Local | Mudança |
|-------|---------|
| `CriarContaAssociadoForm.tsx` | Usar `FunctionsHttpError` para extrair mensagem de erro corretamente |
| Banco de dados | Vincular associado ao usuário existente |

## Resultado Esperado

1. Mensagens de erro específicas serão exibidas (ex: "Este email já está em uso")
2. O MARCUS poderá fazer login normalmente após a correção no banco
3. Futuros erros da Edge Function serão exibidos corretamente
