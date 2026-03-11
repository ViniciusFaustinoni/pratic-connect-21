

# Diagnóstico: Preços errados + Sem filtro por veículo

## Problema 1 — Preços iguais para todos os planos

Todos os planos mostram R$ 145,00 porque o **fallback de preço** está mascarando a busca real. Quando a lookup na `tabelas_preco_mensalidade` falha (por qualquer razão — região não selecionada, combustível não batendo, etc.), o código cai neste trecho:

```text
// usePlanosCotacao.ts linha 253
if (valorMensal === 0) {
  valorMensal = Math.round(valorFipe * taxaFallback / 12);
}
```

Isso gera o **mesmo valor** para TODOS os planos (ex: FIPE ~R$70k × 2.5% ÷ 12 = R$145,00), ignorando o `adicional_mensal` de cada plano (PREMIUM +30, EXCLUSIVE +60).

A política atual do sistema já define: **"quando não há dados no banco, exibir 'Consulte um consultor'"** — mas o fallback ainda existe no código.

## Problema 2 — Nenhum filtro por veículo

Todos os planos têm `fipe_minima = 0` e `fipe_maxima = 999999999` na tabela `planos`. As faixas reais de FIPE existem apenas na `tabelas_preco_mensalidade` (ex: Elétrico começa em R$80k, Especial vai até R$120k, Select até R$180k). Mas como o fallback "inventa" um preço quando não há faixa, os planos nunca são excluídos.

## Solução — Remover fallback + usar faixas como filtro natural

### Alteração 1: `usePlanosCotacao.ts`
- **Remover** o bloco de fallback (linhas 252-256)
- Se `valorMensal === 0` após busca na tabela, o plano **não é incluído** na lista (skip com `continue`)
- Isso resolve AMBOS os problemas simultaneamente:
  - Planos sem faixa para o FIPE/região do veículo desaparecem
  - Planos que encontram faixa mostram o valor real + adicional_mensal

### Alteração 2: `useCalcularCotacao.ts` (cotação pública)
- Aplicar a mesma remoção de fallback para consistência
- Já tem fallback idêntico nas linhas 121-123

### Resultado esperado

Para um carro FIPE R$70.000, gasolina, RJ, particular:

```text
ANTES (fallback):
✗ SELECT BASIC       R$ 145,00  (fallback)
✗ SELECT PREMIUM     R$ 145,00  (fallback)
✗ SELECT EXCLUSIVE   R$ 145,00  (fallback)
✗ SELECT ONE         R$ 145,00  (fallback)
✗ ESPECIAL           R$ 145,00  (fallback)
✗ ELÉTRICOS          R$ 145,00  (fallback — nem deveria aparecer)

DEPOIS (real):
✓ SELECT BASIC       R$ 243,90  (faixa real)
✓ SELECT PREMIUM     R$ 273,90  (faixa + adicional 30)
✓ SELECT EXCLUSIVE   R$ 303,90  (faixa + adicional 60)
✓ SELECT ONE         R$ 355,20  (faixa própria)
✓ ESPECIAL           R$ 145,00  (faixa própria)
✗ ELÉTRICOS          (oculto — sem faixa para gasolina)
✗ LANÇAMENTO         (oculto — ano_minimo 2024)
```

### Arquivos modificados
- `src/hooks/usePlanosCotacao.ts` — remover fallback, adicionar `continue` quando sem faixa
- `src/hooks/useCalcularCotacao.ts` — mesma remoção de fallback

