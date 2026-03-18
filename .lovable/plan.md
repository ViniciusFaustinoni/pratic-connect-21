

## Plano: Bloco informativo de depreciação no cotador

### Objetivo
Quando o veículo tiver uma categoria de deságio selecionada no cotador, exibir um bloco informativo entre a listagem de planos e o card de ações, mostrando o impacto da depreciação no ressarcimento integral.

### Mapeamento categoria → flag
O cotador usa valores como `leilao`, `placa_vermelha`, `ex_taxi`, `taxi`, `chassi_remarcado`, `ressarcimento_integral`. As regras de depreciação usam flags como `flag_leilao`, `flag_placa_vermelha`, etc. O mapeamento é direto: `flag_` + categoria (com exceção de `taxi` → `flag_taxi_ativo` e `ressarcimento_integral` → `flag_ex_ressarcido`).

### Alterações

**1. Novo componente: `src/components/cotacao/BlocoDepreciacaoCotacao.tsx`**
- Recebe `categoria`, `valorFipe`, e opcionalmente `temAvarias` (boolean, default false — no cotador não há flag de avarias, mas deixar preparado)
- Busca `regras_depreciacao` via `useConfiguracaoJson` (reutilizando o mesmo hook e fallback do modal de sinistro)
- Mapeia a categoria selecionada para a flag correspondente
- Filtra as regras não-adicionais que correspondem à categoria, pega o maior percentual (mesma lógica do modal)
- Se `temAvarias`, aplica a depreciação adicional composta
- Exibe: valor FIPE, percentual aplicado, valor estimado de ressarcimento
- Visual: Card com borda amber/warning, ícone AlertTriangle, texto informativo

**2. `src/components/cotacao/EtapaResultado.tsx`**
- Importar e renderizar `BlocoDepreciacaoCotacao` entre o bloco de planos (linha 244) e o card de ações (linha 247)
- Passar `categoria`, `valorFipe` como props (já disponíveis)
- Condicional: só renderiza se `categoria` está na lista de categorias de deságio

### Lógica de cálculo (extraída/reutilizada do modal)
```typescript
// Mapear categoria do cotador → flag de depreciação
const CATEGORIA_FLAG_MAP: Record<string, string> = {
  placa_vermelha: 'flag_placa_vermelha',
  ex_taxi: 'flag_ex_taxi',
  taxi: 'flag_taxi_ativo',
  chassi_remarcado: 'flag_chassi_remarcado',
  leilao: 'flag_leilao',
  ressarcimento_integral: 'flag_ex_ressarcido',
};

// Buscar regra correspondente, aplicar maior percentual entre concorrentes
// Se avarias: aplicar composto adicional
```

### Exibição
```
⚠️ Impacto no Ressarcimento Integral
┌─────────────────────────────────────────────┐
│ Valor FIPE:              R$ 45.000,00       │
│ Depreciação (Leilão):    -30%               │
│ Valor estimado:          R$ 31.500,00       │
│                                             │
│ ℹ Em caso de perda total, o ressarcimento   │
│   será calculado com base no valor acima.   │
└─────────────────────────────────────────────┘
```

### Arquivos
| Arquivo | Alteração |
|---|---|
| `src/components/cotacao/BlocoDepreciacaoCotacao.tsx` | Novo componente |
| `src/components/cotacao/EtapaResultado.tsx` | Renderizar o bloco condicionalmente |

