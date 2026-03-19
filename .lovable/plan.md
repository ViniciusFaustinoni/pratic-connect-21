

# Adicionar `notificationDisabled: true` em todas as criações de clientes no Asaas

## O que muda

Todas as chamadas POST para `/customers` na API do Asaas passarão a incluir `notificationDisabled: true`, impedindo que o Asaas envie notificações/cobranças diretamente. Os disparos serão feitos pelo sistema Praticcar.

## Arquivos e locais de alteração

| Arquivo | Linha | Situação atual |
|---------|-------|----------------|
| `supabase/functions/asaas-clientes/index.ts` | 116 | `notificationDisabled: false` → mudar para `true` |
| `supabase/functions/asaas-clientes/index.ts` | ~265 | Sem o parâmetro → adicionar `notificationDisabled: true` |
| `supabase/functions/autentique-webhook/index.ts` | ~619 | Sem o parâmetro → adicionar `notificationDisabled: true` |
| `supabase/functions/processar-termo-evento/index.ts` | ~228 | Sem o parâmetro → adicionar `notificationDisabled: true` |
| `supabase/functions/processar-termo-evento/index.ts` | ~374 | Sem o parâmetro → adicionar `notificationDisabled: true` |
| `supabase/functions/retroativo-pagamento-termo/index.ts` | ~95 | Sem o parâmetro → adicionar `notificationDisabled: true` |
| `supabase/functions/asaas-cobranca-adesao/index.ts` | ~268 | Sem o parâmetro → adicionar `notificationDisabled: true` |

Total: 7 pontos de criação de customer em 5 edge functions. Cada um recebe `notificationDisabled: true`.

