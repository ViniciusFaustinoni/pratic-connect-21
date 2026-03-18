

## Problema: Honda Fit detectado como moto → planos Advanced aparecem para carros

### Causa raiz

No `useDetectarTipoVeiculo.ts`, a lógica de detecção tem 3 regras em cascata:

1. **Regra 2 (linha 52-63)**: Busca `HONDA` + `%FIT LX%` na tabela `plano_elegibilidade_modelos`. Não encontra nada porque a tabela tem `"FIT"` (sem "LX"). Nenhum resultado → segue para verificação genérica.

2. **Verificação genérica (linha 66-81)**: Busca registros `HONDA` com `linha_slug = 'advanced'`. Encontra **"TODOS OS MODELOS NACIONAIS"** (2 registros). Como o modelo contém "TODOS", retorna `'moto'`.

3. Resultado: Honda Fit é classificado como **moto**, o filtro na linha 388 de `usePlanosCotacao.ts` permite Advanced/Advanced+ e bloqueia Select/Especial.

O filtro `vehicleType === 'motorcycle'` na linha 388 funciona corretamente — o problema está **antes**, na detecção do tipo de veículo.

### Solução

**Arquivo:** `src/hooks/useDetectarTipoVeiculo.ts`

Alterar a verificação genérica (linhas 65-81) para só retornar `'moto'` se a marca **não tiver** registros em linhas de carro. Se Honda tem modelos em `select`, `especial`, etc., a presença de "TODOS" no `advanced` não deve classificar automaticamente como moto — a marca é mista.

Lógica corrigida:

```typescript
// Checar modelos genéricos — MAS só se a marca NÃO tiver registros em linhas de carro
const { data: genericData } = await supabase
  .from('plano_elegibilidade_modelos')
  .select('linha_slug, modelo')
  .ilike('marca', marcaNorm)
  .eq('linha_slug', 'advanced')
  .eq('is_active', true)
  .limit(10);

if (genericData && genericData.length > 0) {
  const hasGeneric = genericData.some(r =>
    r.modelo?.toUpperCase().includes('TODOS') ||
    r.modelo?.toUpperCase().includes('NACIONAL') ||
    r.modelo?.toUpperCase().includes('IMPORTAD')
  );
  if (hasGeneric) {
    // Verificar se a marca também tem registros em linhas NÃO-advanced
    const { data: nonAdvanced } = await supabase
      .from('plano_elegibilidade_modelos')
      .select('id')
      .ilike('marca', marcaNorm)
      .neq('linha_slug', 'advanced')
      .eq('is_active', true)
      .limit(1);
    
    // Só classificar como moto se NÃO houver registros em outras linhas
    if (!nonAdvanced || nonAdvanced.length === 0) {
      return 'moto';
    }
    // Marca mista com genérico advanced → não conclusivo, segue para fallback
  }
}
```

Mesma lógica deve ser aplicada na **Regra 2b** (linhas 84-95): a verificação `allAdvanced` já é correta para marcas que SÓ têm registros advanced, mas o fluxo chega lá mesmo com marcas mistas quando o modelo não é encontrado.

### Impacto esperado

- **Honda Fit LX** → Regra 2 não encontra modelo exato → genérico "TODOS" existe mas Honda tem registros em outras linhas → **não retorna 'moto'** → fallback keyword retorna **'carro'** → planos Advanced filtrados corretamente
- **Honda CG 160** → Se modelo "CG 160" existe no advanced → Regra 2 retorna 'moto' corretamente
- **Marcas exclusivas de moto** (Suzuki, Dafra) → Regra 1 já pega antes → sem impacto
- **Marcas mistas genéricas** (Yamaha com "TODOS" no advanced) → mesma correção se aplica

