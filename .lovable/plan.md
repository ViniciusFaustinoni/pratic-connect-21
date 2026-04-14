

## Plano: Atualizar domínio dos links para `app.praticcar.org`

### Problema
O link de cotação enviado pela IA usa `https://pratic-connect-21.lovable.app` em vez do domínio publicado `https://app.praticcar.org`. Isso acontece em **23 arquivos** de edge functions com URLs hardcoded.

### Correção

**Abordagem centralizada:**

1. **Criar uma constante compartilhada** em `supabase/functions/_shared/constants.ts`:
   ```typescript
   export const APP_BASE_URL = "https://app.praticcar.org";
   ```

2. **Atualizar os arquivos que usam o domínio hardcoded** — os principais:

| Arquivo | Linha | Contexto |
|---------|-------|----------|
| `agente-consultor-ia/index.ts` | 1420 | Link da cotação enviada pela IA |
| `analisar-evento/index.ts` | 176 | Link de evento |
| `gerar-link-retirada/index.ts` | 56 | Link de retirada |
| `gerar-link-vistoriador-prestador/index.ts` | 88 | Link vistoria prestador |
| `aprovar-solicitacao-ia/index.ts` | 321 | Link de evento/sinistro |
| `despacho-reboque-atribuir/index.ts` | 207 | Link acompanhamento reboque |
| `despacho-reboque-disparar/index.ts` | 247 | Link app |
| `cron-followup-reagendamento/index.ts` | 76 | Link reagendamento |
| `autentique-webhook/index.ts` | 732 | Link pagamento |
| `_shared/template-utils.ts` | 769 | Logo em templates HTML |
| `autentique-os-saida-create/index.ts` | 222, 258 | Logo em templates |
| `autentique-evento-create/index.ts` | 236, 272 | Logo em templates |

3. **Substituir** todas as ocorrências de `pratic-connect-21.lovable.app` por importação da constante ou diretamente por `app.praticcar.org`.

4. **Deploy** de todas as edge functions afetadas.

### Nota sobre logos
Os templates HTML de documentos Autentique referenciam `https://pratic-connect-21.lovable.app/logos/logo-full-light.png`. Esses também serão atualizados para `https://app.praticcar.org/logos/logo-full-light.png` — desde que o logo exista no domínio customizado (que aponta para o mesmo deploy, então deve funcionar).

### Prioridade imediata
Se preferir uma correção rápida apenas no agente IA, posso alterar somente a linha 1420 do `agente-consultor-ia/index.ts` e fazer deploy. Os demais arquivos seriam atualizados em seguida.

