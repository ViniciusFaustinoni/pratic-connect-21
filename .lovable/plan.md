# Substituição — cotação deve permitir os 6 dias de vencimento

## Diagnóstico

`CotacaoFormDialog` decide os dias de vencimento por `calcularOpcoesVencimento(hoje)`, que devolve **só 2 opções** (regra de janela de faturamento ASAAS para nova adesão).

```ts
// CotacaoFormDialog.tsx, linha 361
const opcoesVencimento = useMemo((): [number, number] => {
  const hoje = new Date().getDate();
  return calcularOpcoesVencimento(hoje);  // ex.: [5, 10]
}, []);
```

Substituição **não é nova adesão**: reaproveita contrato/mensalidade já existentes e o `efetivar-substituicao` aceita qualquer dia válido. Tanto que `StepFinanceiro.tsx:599` já mostra os 6 dias `[5, 10, 15, 20, 25, 30]`. A divergência acontece quando o consultor avança e abre o `CotacaoFormDialog` para criar a nova cotação — volta a só 2 opções.

## Fix (escopo mínimo)

Mudanças apenas em UI, sem migration, sem edge:

1. **`src/components/cotacoes/CotacaoFormDialog.tsx`** — quando `origemSubstituicao` existir, usar o set completo `[5, 10, 15, 20, 25, 30]` no lugar de `calcularOpcoesVencimento(hoje)`. Tipo do `opcoesVencimento` passa a ser `readonly number[]` (já é assim em `SectionComercialProps.opcoesVencimento`). A validação no submit (linha 1684) já usa `opcoesVencimento.includes(...)`, então acompanha sozinha.

2. **`src/components/cotacoes/form-sections/SectionComercial.tsx`** — o grid hoje é `grid-cols-2`. Trocar para `grid-cols-3` quando `opcoesVencimento.length > 2`, para os 6 cards renderizarem em 2 linhas × 3 colunas sem ficar espremido.

## Fora do escopo (proposital)

- **Troca de titularidade**: pelo mesmo raciocínio também poderia abrir os 6, mas o pedido foi substituição. Posso estender se você quiser — me avisa.
- **Nova adesão**: continua com a janela de 2 opções (regra ASAAS).

## Validação

- Abrir cotação por dentro do fluxo de Substituição → bloco "Data de Vencimento" mostra 6 cards.
- Selecionar dia 25 (ou qualquer fora da janela de "hoje") → submit aceita.
- Abrir cotação nova adesão normal → continua com 2 opções.

Confirma que faço só substituição, ou estendo para troca também?
