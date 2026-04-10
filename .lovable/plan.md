

## Revisão: Duplicação de Planos com Desconto

### Status atual

**Regra 1 - Clonar tudo**: Parcialmente OK
- Benefícios (`benefits` + `planos_beneficios`): copiados corretamente
- Coberturas (`coberturas`): copiadas corretamente
- **BUG**: A tabela de vínculo `planos_coberturas` NÃO clona os campos financeiros. Só insere `plano_id` e `cobertura_id`, perdendo: `franquia_valor`, `franquia_percentual`, `valor_limite`, `percentual_cobertura`, `carencia_dias`, `obrigatoria`.

**Regra 2 - Desconto em todos os valores**: Parcialmente OK
- Coberturas: desconto aplicado em `valor`, `valor_limite`, `franquia_valor` na tabela `coberturas`
- Benefícios: desconto aplicado em `preco_sugerido` na tabela `benefits`
- Faixas FIPE: desconto aplicado nas regras de elegibilidade
- **BUG**: Os campos financeiros da tabela `planos_coberturas` (`franquia_valor`, `valor_limite`) não recebem desconto porque nem sequer são copiados

### Correção necessária

**Arquivo**: `src/hooks/usePlansAdmin.ts` (linhas 565-568)

Alterar a inserção em `planos_coberturas` para copiar todos os campos do vínculo original e aplicar desconto nos campos financeiros:

```
// Buscar dados completos do vínculo original
const { data: origPC } = await supabase
  .from('planos_coberturas')
  .select('*')
  .eq('plano_id', id)
  .eq('cobertura_id', pc.cobertura_id)
  .single();

// Inserir com todos os campos + desconto
await supabase.from('planos_coberturas').insert({
  plano_id: createdPlan.id,
  cobertura_id: newCob.id,
  carencia_dias: origPC?.carencia_dias,
  franquia_percentual: origPC?.franquia_percentual,
  franquia_valor: applyDiscount(origPC?.franquia_valor, desconto),
  obrigatoria: origPC?.obrigatoria,
  percentual_cobertura: origPC?.percentual_cobertura,
  valor_limite: applyDiscount(origPC?.valor_limite, desconto),
});
```

### Resumo
Uma correção de ~15 linhas que garante que a duplicação copia e desconta **todos** os campos financeiros da relação plano-cobertura.

