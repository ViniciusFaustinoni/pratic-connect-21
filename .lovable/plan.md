

# Corrigir logradouro com número embutido

## Problema
O registro do Marcus Vinicius tem `logradouro: "EST CAFUNDA 725"` e `numero: "1"`. O número real (725) está concatenado no logradouro, e o campo `numero` recebeu um valor incorreto ("1"). Isso faz o termo exibir "EST CAFUNDA 725, 1".

Apenas 1 registro tem esse problema atualmente, mas a prevenção deve ser adicionada na importação.

## Solução

### 1. Migration — corrigir o registro existente
```sql
UPDATE associados 
SET logradouro = 'EST CAFUNDA', numero = '725'
WHERE logradouro = 'EST CAFUNDA 725' AND numero = '1';
```

### 2. Edge Function `api-externa/index.ts` — sanitizar na importação
Adicionar função de sanitização antes do insert de associados:

```ts
function sanitizarEndereco(logradouro: string, numero: string): { logradouro: string; numero: string } {
  // Se o numero parece inválido ('1', vazio) e o logradouro termina com número,
  // extrair o número do final do logradouro
  const match = logradouro.match(/^(.+?)\s+(\d{2,5})$/);
  if (match && (!numero || numero === '1' || numero === 'S/N')) {
    // Verificar que a parte antes do número não é um nome de rua numérico (Rua 36, etc)
    const parteRua = match[1].trim();
    const ultimaPalavra = parteRua.split(/\s+/).pop()?.toUpperCase();
    const prefixosRua = ['RUA', 'AVENIDA', 'AV', 'TRAVESSA', 'TV', 'BECO', 'ALAMEDA', 'AL', 'RODOVIA', 'ESTRADA'];
    if (!prefixosRua.includes(ultimaPalavra || '')) {
      return { logradouro: parteRua, numero: match[2] };
    }
  }
  return { logradouro, numero };
}
```

Aplicar antes do insert: se `body.logradouro` e `body.numero` existem, sanitizar.

## Arquivos afetados

| Arquivo | Alteração |
|---|---|
| Migration SQL | Fix do registro existente |
| `supabase/functions/api-externa/index.ts` | +sanitizarEndereco antes do insert |

## Impacto
- 1 registro corrigido imediatamente
- Importações futuras terão o endereço sanitizado automaticamente

