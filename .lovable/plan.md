

## Plano: Corrigir Filtro de Elegibilidade (Especial/Especial Plus)

### Diagnóstico

O problema está na condição de bypass em `usePlanosCotacao.ts` linha 394:

```typescript
if (params.marca && params.modelo && anoVeiculoNum && elegibilidadeData && !elegibilidadeLoading) {
```

Quando **qualquer** destas condições falha — marca/modelo vazios, dados ainda carregando, ou ano não informado — o filtro de elegibilidade é **completamente ignorado** e todos os planos aparecem como "aprovados", mesmo que tenham regras de whitelist configuradas no banco (Especial tem ~50 regras, Especial Plus tem 12).

Dois cenários causam o bug:
1. **Race condition**: `elegibilidadeData` ainda está carregando → check ignorado → planos aparecem
2. **Marca/modelo vazios**: Se `marcaResolvida` ou `modeloResolvido` resolver como `''`, a conversão `|| undefined` na linha 348-349 torna falsy → check ignorado

### Correção em `src/hooks/usePlanosCotacao.ts`

**1. Quando elegibilidade está carregando, não calcular planos (L311-316)**

Adicionar `elegibilidadeLoading` como condição para retornar lista vazia, evitando flash de planos não filtrados:

```typescript
if (!valorFipe || valorFipe <= 0 || !planosBanco || elegibilidadeLoading) {
  return { planos: [], planosNegados: [] };
}
```

**2. Quando marca/modelo não estão disponíveis mas existem regras, negar o plano (L389-416)**

Reformular a lógica para: se existem regras de elegibilidade para a linha do plano, a verificação é obrigatória. Se marca/modelo não foram informados, tratar como negado (não é possível verificar):

```typescript
// Verificar se existem regras de elegibilidade para esta linha
const planosNaLinhaIds = linha
  ? (planosBanco || []).filter(p => (p.linha || '').toLowerCase() === linha).map(p => p.id)
  : [plano.id];
const temRegrasElegibilidade = elegibilidadeData?.some(e => planosNaLinhaIds.includes(e.plano_id)) ?? false;

let elegibilidadeStatus: 'aprovado' | 'limitado' | 'negado' | undefined = undefined;

if (temRegrasElegibilidade) {
  if (params.marca && params.modelo && anoVeiculoNum) {
    elegibilidadeStatus = verificarElegibilidadeModelo(
      plano.id, linha,
      { marca: params.marca, modelo: params.modelo, ano: anoVeiculoNum, combustivel: combustivelOriginal }
    );
  } else {
    // Regras existem mas não temos dados do veículo para validar → negar
    elegibilidadeStatus = 'negado';
  }

  if (elegibilidadeStatus === 'negado') {
    negados.push({ planoId: plano.id, planoNome: plano.nome, linha, motivo: 'Modelo não elegível para este plano' });
    continue;
  }
}
```

### Arquivo afetado
- `src/hooks/usePlanosCotacao.ts`

### Resultado esperado
- Planos Especial e Especial Plus só aparecem para veículos explicitamente listados na whitelist
- Sem flash de planos durante carregamento
- Planos sem regras de elegibilidade continuam aparecendo normalmente

