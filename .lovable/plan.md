

# Plano: Padronizar termo para "Proteção 360º"

## Resumo

Substituir todas as ocorrências de "Proteção Total", "Proteção Completa" e "Proteção completa" por "Proteção 360º" nos textos voltados ao usuário. Manter inalterados comentários internos de código.

## Alterações

| Arquivo | Linha | De | Para |
|---------|-------|----|------|
| `src/pages/public/LandingPlanos.tsx` | 87 | `'Proteção Total'` | `'Proteção 360º'` |
| `src/pages/public/LandingPlanos.tsx` | 63 | `Proteção completa, assistência 24h...` | `Proteção 360º, assistência 24h...` |
| `src/pages/public/LandingPlanos.tsx` | 105 | `Proteção completa a partir de...` | `Proteção 360º a partir de...` |
| `src/components/cotacao-publica/EscolhaPlano.tsx` | 201 | `Proteção Completa` | `Proteção 360º` |
| `src/components/cotacao-publica/EscolhaPlano.tsx` | 318 | `Proteção completa para seu veículo...` | `Proteção 360º para seu veículo...` |
| `src/components/veiculos/BadgeCobertura.tsx` | 31 | `Proteção completa contra roubo...` | `Proteção 360º contra roubo...` |
| `src/components/cadastro/StatusCoberturaCard.tsx` | 92 | `Proteção completa com rastreamento ativo` | `Proteção 360º com rastreamento ativo` |
| `src/types/canvas-editor.ts` | 216 | `'Proteção Completa'` | `'Proteção 360º'` |
| `src/data/associadoTeste.ts` | 178 | `'Proteção Completa'` | `'Proteção 360º'` |

**Não alterado**: `supabase/functions/whatsapp-webhook/index.ts` linha 3366 — é comentário interno de código ("proteção total" no sentido técnico de loop protection), não nome de produto.

