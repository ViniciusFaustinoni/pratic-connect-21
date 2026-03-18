

## Plano: Bloco de depreciação na tela de detalhes do associado (aba veículos)

### Contexto

A aba "Veículos" em `AssociadoDetalhe.tsx` lista os veículos do associado com dados básicos e botões de ação. O hook `useVeiculosDoAssociado` já faz `select('*')`, ou seja, todas as flags de depreciação (`flag_placa_vermelha`, `flag_leilao`, etc.) já estão disponíveis nos dados do veículo. O componente `BlocoDepreciacaoCotacao` já implementa a lógica de exibição, mas recebe uma `categoria` (string do cotador) — aqui precisamos trabalhar diretamente com as flags booleanas do veículo.

### Alterações

**1. Novo componente: `src/components/associados/detalhe/BlocoDepreciacaoVeiculo.tsx`**
- Recebe as flags do veículo (`flag_placa_vermelha`, `flag_leilao`, etc.) e `valorFipe`
- Busca `regras_depreciacao` via `useConfiguracaoJson` (mesma abordagem do cotador e modal)
- Identifica quais flags estão ativas, filtra as regras concorrentes correspondentes, aplica a de maior percentual
- Se `flag_avarias_vistoria` ativa, aplica depreciação adicional composta
- Visual idêntico ao `BlocoDepreciacaoCotacao` (borda amber, AlertTriangle, valores calculados)
- Retorna `null` se nenhuma flag ativa

**2. `src/pages/cadastro/AssociadoDetalhe.tsx`**
- Dentro do loop de veículos na aba "veiculos" (linha ~602, após o `</CardContent>`), renderizar `BlocoDepreciacaoVeiculo` para cada veículo que tenha flags ativas
- Passar as flags booleanas e `valor_fipe` do veículo como props

### Lógica (reutilizada do modal)

```text
flags ativas → filtrar regras concorrentes (adicional=false) → pegar maior percentual
valorEstimado = valorFipe * (1 - maiorPercentual/100)
se flag_avarias_vistoria → valorEstimado *= (1 - percentualAvarias/100)
```

### Arquivos

| Arquivo | Alteração |
|---|---|
| `src/components/associados/detalhe/BlocoDepreciacaoVeiculo.tsx` | Novo componente |
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Renderizar bloco dentro de cada card de veículo |

