

## Plano: Elegibilidade como filtro real + deságio para limitados

### Problema
Em `usePlanosCotacao.ts`, linhas 335-346, a elegibilidade é calculada mas **descartada**:
```typescript
// Elegibilidade negada não exclui o plano — apenas sinaliza visualmente no card
```
O resultado é recalculado nas linhas 467-474 apenas para preencher o badge. Planos como ESPECIAL PLUS (whitelist de 12 modelos) aparecem para qualquer veículo de passeio.

### Solução

**Arquivo único:** `src/hooks/usePlanosCotacao.ts`

#### 1. Transformar elegibilidade em gate real (linhas 335-346)

Substituir o bloco que descarta o resultado por lógica de filtragem:

```typescript
const combustivelOriginal = (combustivel || 'flex').toLowerCase();
let elegibilidadeStatus: 'aprovado' | 'limitado' | 'negado' | undefined = undefined;

if (params.marca && params.modelo && anoVeiculoNum && elegibilidadeData && !elegibilidadeLoading) {
  elegibilidadeStatus = verificarElegibilidadeModelo(plano.id, {
    marca: params.marca,
    modelo: params.modelo,
    ano: anoVeiculoNum,
    combustivel: combustivelOriginal,
  });

  // HARD GATE: planos negados são excluídos da cotação
  if (elegibilidadeStatus === 'negado') {
    negados.push({
      planoId: plano.id,
      planoNome: plano.nome,
      linha,
      motivo: 'Modelo não elegível para este plano',
    });
    continue;  // ← Não aparece na cotação
  }
}
```

- `negado` → plano excluído, adicionado à lista `planosNegados` (já existe a interface, nunca era populada)
- `limitado` → plano visível com badge amarelo + regras de deságio aplicadas
- `aprovado` → plano visível normal

#### 2. Aplicar deságio automático para planos limitados (após linha 417)

Quando `elegibilidadeStatus === 'limitado'`, aplicar as mesmas cotas de deságio (cota maior, mínima maior), independente de ser app ou passeio:

```typescript
// Deságio para elegibilidade limitada (mesma lógica de app)
if (elegibilidadeStatus === 'limitado') {
  cotaPercentual = Number(plano.cota_desagio) || cotaDesagioDefault;
  cotaMinimaFinal = Number(plano.cota_minima_desagio) || cotaMinimaDesagioDefault;
}
```

#### 3. Usar variável já calculada no push (linhas 467-474)

Substituir a rechamada de `verificarElegibilidadeModelo` pela variável `elegibilidadeStatus` já calculada:

```typescript
elegibilidadeStatus: elegibilidadeStatus,
```

Isso elimina a dupla avaliação e garante consistência entre filtragem e exibição.

### Resultado esperado
- Veículos de passeio comuns (ex: Voyage, HB20) **não verão** ESPECIAL PLUS (apenas 12 modelos elegíveis)
- Veículos com status `limitado` verão o plano com badge amarelo e cota de deságio aplicada automaticamente
- A lista `planosNegados` é populada corretamente para eventual exibição de "planos indisponíveis"
- Matching de modelo permanece por prefixo (já implementado)

