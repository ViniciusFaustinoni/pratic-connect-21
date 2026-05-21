## Diagnóstico

A placa LTC8G02 (FIPE R$ 44.921) está caindo no **Estágio A — Preliminar** da `fipeMenorInfo` em `src/components/cotacoes/CotacaoFormDialog.tsx`. Esse estágio é executado quando o usuário ainda não selecionou plano (caso da "Cotação Rápida" no screenshot).

Trecho (linhas 661–673):

```ts
// === ESTÁGIO A — Preliminar (sem plano selecionado) ===
if (planosSelecionados.length === 0) {
  return {
    elegivel: true,         // ← sempre true
    preliminar: true,
    bloqueado: null,
    valorReduzido,          // valorFipe * 0.99
    faixaAtual: null,
    faixaInferior: null,
    economia: 0,
  };
}
```

No Estágio A o flag `elegivel` é setado **cego como `true`** assim que o FIPE passa pelos dois bloqueios anteriores (mínimo por tipo e zona R$ 30k–R$ 35k). Não há verificação se o valor reduzido cruza a fronteira da faixa atual.

### Por que isso quebra LTC8G02

- FIPE atual: **R$ 44.921,00** → faixa enquadrada **R$ 40.000,00 – R$ 44.999,99**
- FIPE − 1% = **R$ 44.471,79**
- R$ 44.471,79 > R$ 40.000,00 → **continua dentro da MESMA faixa**

A "Regra do 1%" só faz sentido quando a redução de 1% **derruba o veículo para a faixa imediatamente inferior** (e portanto para uma mensalidade menor). Como 44.471,79 não cruza o piso de 40.000, não existe redução de cota possível — mas o painel anuncia "Veículo elegível à redução de cota" porque o Estágio A não roda essa checagem.

A prova de que a checagem existe (e está correta) está no Estágio B (linha 706), executado quando há plano selecionado:

```ts
const elegivel = valorReduzido < faixaAtualRule.de;
```

Aplicando essa regra ao caso: `44471.79 < 40000` → `false` → não elegível. O Estágio B daria a resposta certa, mas o Estágio A já contaminou a UI antes de chegar lá.

### Causa raiz

O Estágio A foi desenhado para "anunciar elegibilidade já no carregamento do FIPE, sem esperar o plano". O problema é que ele precisa de **uma fronteira de faixa** para decidir se o −1% cruza algo. Como sem plano selecionado não temos a regra `fipe_range` específica, a única referência disponível é o catálogo `todasFaixas` (já carregado para o fallback legado).

### Plano de correção

1. **Substituir o `elegivel: true` cego do Estágio A por uma verificação preliminar de fronteira**, usando a faixa enquadrada do catálogo `todasFaixas` (mesma fonte que alimenta o texto "Faixa enquadrada" na UI logo acima do painel).

   Pseudocódigo:

   ```ts
   if (planosSelecionados.length === 0) {
     const faixaAtualGenerica = todasFaixas
       .filter(f => valorFipe >= f.fipe_min && valorFipe <= f.fipe_max)
       .sort((a, b) => (b.fipe_max - b.fipe_min) - (a.fipe_max - a.fipe_min))[0];

     // Sem catálogo carregado → fica em "preliminar elegível" como hoje
     // (evita regressão em ambientes onde todasFaixas vem vazio).
     const elegivelPreliminar =
       !faixaAtualGenerica || valorReduzido < faixaAtualGenerica.fipe_min;

     return {
       elegivel: elegivelPreliminar,
       preliminar: true,
       bloqueado: null,
       valorReduzido,
       faixaAtual: null,
       faixaInferior: null,
       economia: 0,
     };
   }
   ```

2. **Não tocar no Estágio B nem nos bloqueios anteriores** — eles estão corretos. A correção é cirúrgica no preliminar.

3. **Validação manual**:
   - LTC8G02 (FIPE 44.921) sem plano: painel "Redução de Cota" deve sumir (44.471,79 > 40.000).
   - Veículo FIPE 40.050 sem plano: painel deve continuar aparecendo (40.050 × 0,99 = 39.649,50 < 40.000, cruza a fronteira).
   - Veículo FIPE 50.000 sem plano: depende do catálogo — se a faixa atual começa em 45.000, 49.500 > 45.000, não elegível; se começa em 50.000, sim. Comportamento certo nos dois.
   - Após selecionar plano, o Estágio B continua sendo a fonte da verdade — sem mudança de comportamento.

4. **Persistência**: o flag `solicitar_fipe_menor` e o registro em `aprovacoes_fipe_menor` continuam dependendo do Estágio B (linhas 1792 e 1800), então essa correção não afeta o que vai pro banco — só elimina a falsa promessa visual antes do plano ser escolhido.

### O que NÃO muda

- Bloqueios da zona R$ 30k–R$ 35k (rastreador obrigatório).
- Bloqueio por FIPE mínimo/máximo por tipo (carro/moto).
- Cálculo de economia no Estágio B.
- Auto-aplicação da regra após selecionar plano.
- Memória `mem://logic/pricing/regra-1-porcento-bloqueios` continua válida — esta correção fecha um buraco compatível com ela (não cria regra nova).
