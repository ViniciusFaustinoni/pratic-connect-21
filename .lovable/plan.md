

# Diagnóstico: Por que alguns templates WhatsApp não são disparados

## Problemas identificados

### 1. Nome de parâmetros errados (4 edge functions)
As funções `autentique-create`, `autentique-create-by-token`, `autentique-vistoria-create` e `autentique-evento-create` enviam `params` e `button_params`, mas o `whatsapp-send-text` espera `template_params` e `template_button_params`. Resultado: o template é enviado **sem variáveis** → Meta rejeita por mismatch de parâmetros.

### 2. Nome de parâmetros errados no frontend (`useServicos.ts`)
O envio do template `assinatura_instalacao_v1` usa `template_nome`, `template_variaveis` e `template_botao_variaveis` em vez de `template_name`, `template_params` e `template_button_params`. Resultado: o template é completamente ignorado e a mensagem é tratada como texto livre → bloqueada pela Meta.

### 3. Envio sem `template_name` (`efetivar-troca-titularidade`)
A função envia apenas `telefone` e `mensagem` (texto livre) sem template → bloqueado pela Meta fora da janela 24h. Deveria usar `cadastro_aprovado_botao` ou `notificacao_geral_v1`.

### 4. Fallback para texto livre no `useServicos.ts`
Quando o template `assinatura_instalacao_v1` não está APPROVED, o fallback envia texto livre sem `template_name` nem `allow_text` → bloqueado pela Meta.

## Correções

| Arquivo | Problema | Correção |
|---|---|---|
| `supabase/functions/autentique-create/index.ts` | `params` → ignorado | Renomear para `template_params` e `template_button_params` |
| `supabase/functions/autentique-create-by-token/index.ts` | idem | idem |
| `supabase/functions/autentique-vistoria-create/index.ts` | idem | idem |
| `supabase/functions/autentique-evento-create/index.ts` | idem | idem |
| `src/hooks/useServicos.ts` | `template_nome`, `template_variaveis`, `template_botao_variaveis` | Renomear para `template_name`, `template_params`, `template_button_params`; adicionar `mensagem` obrigatória |
| `supabase/functions/efetivar-troca-titularidade/index.ts` | Sem template_name | Adicionar `template_name: 'cadastro_aprovado_botao'` com params adequados |
| Redeploy das 5 edge functions afetadas | — | Deploy automático |

## Impacto

Essas correções cobrem **todos os cenários onde mensagens são silenciosamente bloqueadas**. Após a correção, o fluxo será:
- Template APPROVED → envio com parâmetros corretos → entrega garantida
- Template PENDING → erro explícito no log (sem envio silencioso quebrado)

