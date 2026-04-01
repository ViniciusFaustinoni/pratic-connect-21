

# Corrigir status de associados criados via API externa

## Problema
Na edge function `api-externa/index.ts`, linha 93, o status do associado é **hardcoded** como `'em_analise'`:
```ts
const insertData: any = {
  nome, cpf: cpfLimpo, email, telefone, status: 'em_analise',
};
```

Quando o associado vem do SGA (já ativo), deveria ser possível definir o status via payload da API.

## Correção

**Arquivo**: `supabase/functions/api-externa/index.ts`

**Linha 93**: Permitir que o campo `status` venha no body da requisição, com fallback para `'em_analise'`:

```ts
const insertData: any = {
  nome, cpf: cpfLimpo, email, telefone, 
  status: body.status || 'em_analise',
};
```

Adicionalmente, adicionar `'status'` à lista de `optionalFields` (linha 95-98) **não é necessário** pois já estará no `insertData` acima.

## Impacto
- 1 linha alterada na edge function
- Deploy automático
- Quem chamar a API com `"status": "ativo"` terá o associado criado como ativo
- Chamadas sem `status` continuam como `em_analise` (backward compatible)

