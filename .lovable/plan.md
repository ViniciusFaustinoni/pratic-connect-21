

## Plano: Aba "Repasse Maior" na página Regras de Venda

### Dados

Inserir 5 novos parâmetros em `comissoes_parametros` (via insert tool, não migração):

| chave | valor |
|---|---|
| `repasse_maior_corte_boletos` | `4` |
| `repasse_maior_pct_favoravel` | `50` |
| `repasse_maior_valor_favoravel` | `100` |
| `repasse_maior_pct_reduzido` | `70` |
| `repasse_maior_valor_reduzido` | `150` |

### Frontend — `src/pages/diretoria/RegrasVenda.tsx`

Adicionar nova aba "Repasse Maior" (ícone `Scale`) com:

- **Bloco 1**: Card com campo inteiro para quantidade de boletos de corte (`repasse_maior_corte_boletos`)
- **Bloco 2**: Card com 2 campos — percentual (%) e valor mínimo (R$) para grupo favorável
- **Bloco 3**: Card com 2 campos — percentual (%) e valor mínimo (R$) para grupo reduzido
- **Bloco 4**: Card informativo (Alert) com nota sobre impacto na pontuação — texto estático, sem campos editáveis
- Botão "Salvar configurações" ao final

Estado local para os 5 campos, inicializado a partir dos `parametros` já carregados pelo `useComissoesFaixas`. Reutiliza `updateParametro` para salvar.

### Backend — Validação de valor mínimo

**`supabase/functions/efetivar-substituicao/index.ts`** (Step 12, antes de aceitar pagamento parcial):
1. Buscar os 5 parâmetros de `comissoes_parametros`
2. Contar boletos pagos do associado em `asaas_cobrancas`
3. Determinar grupo (favorável vs reduzido) com base no corte
4. Calcular `Math.max(debito * pct/100, valorFixo)` como valor mínimo aceitável
5. Se `valor_pago < valorMinimo`, rejeitar a operação

**`supabase/functions/aprovar-solicitacao-ia/index.ts`** (bloco troca_titularidade, ~linha 671):
- Mesma lógica: buscar parâmetros, contar boletos, calcular mínimo, determinar `pagamento_integral` com base no valor efetivamente pago vs mínimo

### Arquivos afetados

- `src/pages/diretoria/RegrasVenda.tsx` — adicionar aba e formulário
- `supabase/functions/efetivar-substituicao/index.ts` — validação de valor mínimo
- `supabase/functions/aprovar-solicitacao-ia/index.ts` — validação de valor mínimo
- Dados: 5 rows em `comissoes_parametros`

