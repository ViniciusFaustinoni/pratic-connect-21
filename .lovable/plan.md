

## Bloquear Regra do 1% na faixa R$ 30k–R$ 35k (rastreador obrigatório)

### Contexto

Veículos com FIPE ≥ R$ 30.000 são obrigados a ter rastreador (regra já vigente — ver memória `tracker-eligibility-and-contract-logic-v2`). Permitir que um veículo nesta faixa "caia" para a faixa anterior via Regra do 1% removeria essa obrigatoriedade — o que não pode acontecer.

### Regra a aplicar

Se a **faixa atual** do veículo estiver dentro do intervalo R$ 30.000 a R$ 35.000 (inclusive), a Regra do 1% deve ser **bloqueada**, independentemente do cálculo de redução.

Exemplos:
- FIPE R$ 30.200 (faixa 30k–35k) → bloqueado, mesmo que -1% caia em faixa < R$ 30k
- FIPE R$ 34.800 (faixa 30k–35k) → bloqueado
- FIPE R$ 35.500 (faixa 35k–40k) → liberado normalmente (nova faixa continua exigindo rastreador)

### Implementação

**1) `src/components/cotacoes/CotacaoFormDialog.tsx` — função `fipeMenorInfo`**

Adicionar nova checagem de bloqueio (Estado C — card amber), antes do retorno de elegibilidade:

```ts
// Faixa atual está na zona de obrigatoriedade do rastreador
const FAIXA_RASTREADOR_MIN = 30000;
const FAIXA_RASTREADOR_MAX = 35000;
if (
  faixaAtual.faixa_min >= FAIXA_RASTREADOR_MIN &&
  faixaAtual.faixa_min < FAIXA_RASTREADOR_MAX
) {
  return {
    elegivel: false,
    bloqueado: {
      motivo: 'Faixa de R$ 30.000 a R$ 35.000 não pode ser reduzida — rastreador é obrigatório nesta faixa.',
    },
    // ...demais campos preservados
  };
}
```

**2) Texto exibido no card amber**

> "Regra do 1% indisponível: a faixa atual (R$ 30.000 – R$ 35.000) exige rastreador obrigatório. A redução não pode ser aplicada."

**3) Memória**

Adicionar entrada em `mem://logic/pricing/regra-1-porcento-bloqueios` documentando todos os bloqueios da Regra do 1%:
- Carros > R$ 120k / Motos > R$ 27k
- Veículos blindados
- Planos cobertura 100% com depreciação
- **Faixa R$ 30k–R$ 35k (rastreador obrigatório)** ← novo

### Arquivos alterados

- `src/components/cotacoes/CotacaoFormDialog.tsx` — adicionar bloqueio na função `fipeMenorInfo`
- `mem://logic/pricing/regra-1-porcento-bloqueios.md` — nova memória consolidando regras
- `mem://index.md` — adicionar referência

### Fora do escopo

- Não mexer em motos: o limite mínimo para rastreador em motos é R$ 9k, então a faixa 30k–35k é uma regra exclusiva de carros. A checagem usa apenas a faixa, não o tipo — motos com FIPE nessa faixa também seriam bloqueadas, o que é seguro pois já passariam de qualquer limite razoável de moto.
- Configuração da faixa fica hardcoded por ora (R$ 30k–R$ 35k espelha o limite mínimo do rastreador). Se quiser tornar editável via `Configurações`, me avise.

