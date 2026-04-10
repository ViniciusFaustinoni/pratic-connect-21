

## Plano: Corrigir preço incorreto em planos duplicados com desconto

### Problema raiz

Após duplicar um plano com 10% de desconto, o desconto é aplicado **duas vezes** em partes diferentes:

1. **Na duplicação**: Os valores estáticos (`coberturas.valor`, `benefits.preco_sugerido`) e os valores das faixas FIPE (`fipe_range`) são todos reduzidos em 10% no banco de dados.
2. **Na cotação**: O motor `usePlanosCotacao.ts` usa os valores de `fipe_range` (já descontados) para coberturas, mas para benefícios usa `preco_sugerido` (também já descontado). Até aqui tudo correto.

**O bug real**: A mutation `useDuplicatePlan` **não invalida** o cache `['entity_eligibility_rules', 'all']` (staleTime de 5 minutos). Isso significa que ao fazer a cotação logo após duplicar, o motor não encontra as `fipe_range` rules dos novos IDs de coberturas e faz fallback para `coberturas.valor` (estático). O resultado é uma mistura de valores estáticos (com desconto) e valores de cache antigo, produzindo um preço incorreto.

Adicionalmente, a invalidação do cache de coberturas/benefícios/planos também pode estar incompleta.

### Correção (1 arquivo)

**`src/hooks/usePlansAdmin.ts`** — No `onSuccess` de `useDuplicatePlan` (linha ~592), adicionar invalidação de:
- `['entity_eligibility_rules', 'all']`
- `['planos_coberturas']` e `['planos_beneficios']` (se existirem como query keys)

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['plans'] });
  queryClient.invalidateQueries({ queryKey: ['planos'] });
  queryClient.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] });
  queryClient.invalidateQueries({ queryKey: ['entity_eligibility_rules'] }); // NOVO
  toast.success('Plano duplicado!');
},
```

Usar `{ queryKey: ['entity_eligibility_rules'] }` sem `'all'` para invalidar todas as sub-queries desse grupo.

### Resultado
Após duplicar um plano, o cache de regras de elegibilidade será atualizado imediatamente, garantindo que as novas fipe_range (com desconto aplicado) sejam usadas na cotação seguinte sem precisar de F5.

