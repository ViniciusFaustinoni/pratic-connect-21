

## Plano: Motos não devem ter adicional de aplicativo

### Problema

Quando o vendedor seleciona "Moto + Aplicativo", o sistema adiciona R$ 35,90 de adicional app ao valor mensal. Porém, para motos os valores são iguais para uso particular e aplicativo — o adicional não se aplica.

O bug ocorre porque `tipoUsoOriginal` é forçado para `'aplicativo'` quando `usoApp=true`, independentemente da linha. Para motos (advanced), isso faz:
1. `resolverTipoUsoQuery` retornar `'particular'` (a tabela de motos usa `'advanced'`, não `'particular'`)
2. `resolverPrecoApp` somar o adicional R$ 35,90 indevidamente

### Solução

Linhas com tipo_uso próprio (ex: `'advanced'`, `'advanced-plus'`) não devem ter seu tipo_uso sobrescrito para `'aplicativo'`. Preservar o tipo_uso nativo garante que:
- A query busca a faixa de preço correta (`tipo_uso='advanced'`)
- O adicional app nunca é aplicado (o check `tipoUsoOriginal === 'aplicativo'` é falso)

### Edições

**1. `src/hooks/usePlanosCotacao.ts` (linha ~408)**

Substituir:
```typescript
const tipoUsoOriginal = params.usoApp ? 'aplicativo' : (mapping?.tipo_uso || 'particular');
```
Por:
```typescript
const mappingTipoUso = mapping?.tipo_uso || 'particular';
const isLinhaTipoUsoProprio = mappingTipoUso !== 'particular' && mappingTipoUso !== 'aplicativo';
const tipoUsoOriginal = isLinhaTipoUsoProprio ? mappingTipoUso : (params.usoApp ? 'aplicativo' : 'particular');
```

**2. `src/hooks/useCalcularCotacao.ts` (linha ~142)**

Mesma lógica:
```typescript
const mappingTipoUso = mapping?.tipo_uso || params.tipo_uso;
const isLinhaTipoUsoProprio = mappingTipoUso !== 'particular' && mappingTipoUso !== 'aplicativo';
const tipoUsoOriginal = isLinhaTipoUsoProprio ? mappingTipoUso : (params.tipo_uso === 'aplicativo' ? 'aplicativo' : mappingTipoUso);
```

**3. `src/hooks/useCotacaoAvancada.ts` (linha ~186)** e **`src/hooks/useCotacao.ts` (linha ~215)**

Nesses hooks o `mapping.tipo_uso` já é usado diretamente. Adicionar guard antes de `resolverPrecoApp`:
```typescript
const isLinhaTipoUsoProprio = mapping.tipo_uso !== 'particular' && mapping.tipo_uso !== 'aplicativo';
if (!isLinhaTipoUsoProprio) {
  valorMensal = resolverPrecoApp(...);
}
```

### Resultado
- Moto + Particular → busca `tipo_uso='advanced'` → preço base correto, sem adicional
- Moto + Aplicativo → busca `tipo_uso='advanced'` → mesmo preço base, sem adicional
- Carro + Aplicativo → continua funcionando normalmente com adicional quando aplicável

