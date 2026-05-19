
## Motivo (resposta direta)

O card verde **"Redução de Cota aplicada (Regra do 1%)"** e a grade de **planos** abaixo dele são calculados de fontes diferentes:

- **Card de redução** (`fipeMenorInfo`, linhas 606–757 de `CotacaoFormDialog.tsx`) usa internamente `valorFipe * 0.99` e mostra `faixaInferior.mensal` — por isso ele exibe corretamente o valor reduzido.
- **Cards dos planos** (linhas 2824+) vêm de `planosCalculados`, que sai do hook `usePlanosCotacao({ valorFipe, ... })` na linha 566. Esse hook recebe o **FIPE original**, nunca o reduzido. Nada na UI repassa `fipeMenorInfo.valorReduzido` para `usePlanosCotacao`.

Resultado: o sistema reconhece a elegibilidade, mostra a "faixa cobrada" correta dentro do card verde, **mas continua renderizando os planos da faixa cheia** porque o hook nunca é re-executado com o valor reduzido.

A redução só é gravada de fato no `submit` (linhas 1733–1750), via `registrarCienciaFipeMenor`, que grava a cotação na faixa inferior com `fipe_menor_aprovado=true`. Ou seja: a redução acontece no banco no momento do save, mas a tela nunca espelha isso antes.

---

## Plano de correção (UI-only, sem backend)

### 1. Derivar um `valorFipeParaPlanos` em `CotacaoFormDialog.tsx`

Logo após o `useMemo` de `fipeMenorInfo` (~linha 757), adicionar:

```ts
const aplicarFipeMenor =
  fipeMenorAtivo &&
  !!fipeMenorInfo?.elegivel &&
  !fipeMenorInfo?.bloqueado;

// Quando a Regra do 1% é elegível, os planos precisam ser recalculados
// na faixa inferior — caso contrário a UI mostra preços de uma faixa
// que NÃO será cobrada.
const valorFipeParaPlanos = aplicarFipeMenor
  ? (fipeMenorInfo?.faixaInferior?.max ?? fipeMenorInfo?.valorReduzido ?? valorFipe)
  : valorFipe;
```

Usar `faixaInferior.max` é mais robusto que `valorFipe * 0.99` porque garante que o hook caia exatamente dentro da faixa imediatamente inferior, mesmo quando o `-1%` não atravessa a borda da faixa (estágio preliminar, sem plano selecionado, faixaInferior será `null` e cai no fallback `valorReduzido`).

### 2. Passar esse valor para `usePlanosCotacao` (linha 566)

```ts
const { planos: planosCalculados, planosNegados, isLoading: planosLoading } = usePlanosCotacao({
  valorFipe: valorFipeParaPlanos,   // ← antes: valorFipe
  // ...resto igual
});
```

### 3. Ajustar a label de "faixa enquadrada" (linha 2481)

Como agora a grade reflete a faixa reduzida, o texto `Faixa enquadrada: …` precisa indicar isso para não confundir o operador:

```tsx
{aplicarFipeMenor && fipeMenorInfo?.faixaInferior ? (
  <p className="text-xs text-muted-foreground mt-1.5">
    Faixa enquadrada (com Regra do 1%):{' '}
    {formatCurrency(fipeMenorInfo.faixaInferior.min)} – {formatCurrency(fipeMenorInfo.faixaInferior.max)}
  </p>
) : faixaAtualFipe && (
  <p className="text-xs text-muted-foreground mt-1.5">
    Faixa enquadrada: {formatCurrency(faixaAtualFipe.min)} – {formatCurrency(faixaAtualFipe.max)}
  </p>
)}
```

### 4. Sanity-check no submit

A lógica de gravação (linhas 1733–1750) já usa `fipeMenorInfo.faixaInferior.mensal` — continua válida. Só conferir que `planoSelecionado.valor_mensal` exibido nos cards bate com `faixaInferior.mensal` quando a redução está ativa (vai bater, porque o hook foi alimentado com a faixa inferior).

### 5. Estágio preliminar (sem plano escolhido)

Quando `fipeMenorInfo.preliminar === true`, `faixaInferior` é `null`. O fallback para `valorReduzido` (`valorFipe * 0.99`) cobre esse caso — pode acontecer de ainda cair na mesma faixa atual se o -1% não cruzar a borda, mas isso é aceitável: assim que o operador escolhe um plano, `faixaInferior` se materializa e os preços ajustam.

---

## Fora do escopo

- Nenhuma mudança em `usePlanosCotacao`, edge functions, banco, ou na lógica de cálculo de `fipeMenorInfo`.
- Nenhuma mudança nas regras de elegibilidade (Regra do 1%, zona de rastreador R$30k–35k, limites por tipo).
- Não mexer no fluxo de "ciência" do supervisor.

---

## Arquivos afetados

- `src/components/cotacoes/CotacaoFormDialog.tsx` (apenas 3 trechos: derivação do valor, prop do hook, label da faixa).

Sem migração, sem nova edge function, sem novo hook.
