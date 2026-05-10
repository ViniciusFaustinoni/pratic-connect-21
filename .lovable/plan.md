## Problema

Na troca de titularidade, o termo de cancelamento é enviado por e-mail (Autentique), mas a notificação WhatsApp para o titular antigo **falha silenciosamente**.

Causa: a edge function `enviar-termo-cancelamento-troca` dispara texto livre via `whatsapp-send-text`. Como a integração está usando a **API Oficial da Meta**, fora da janela de 24h o envio de texto livre é bloqueado — só passam **templates aprovados**.

Evidência: `whatsapp_mensagens` registra erro `"Bloqueado: Meta API ativa requer template_name. Texto livre não é entregue fora da janela 24h."` no momento exato do envio do termo (10/05 17:08:43).

## Solução

Trocar o envio de texto livre pelo template Meta já aprovado **`assinatura_documento_v2`**, que é exatamente para este caso (documento pendente de assinatura com botão "Assinar Agora").

Estrutura do template:
- Variáveis do corpo: `{{1}}` = primeiro nome do associado, `{{2}}` = descrição do documento
- Botão URL: `https://assina.ae/{{1}}` (recebe o **slug curto** do Autentique, não a URL completa)

## Mudanças

### 1. `supabase/functions/enviar-termo-cancelamento-troca/index.ts`

Substituir o bloco "Disparo WhatsApp" (linhas ~241-255) para:

1. Capturar também o **short_link** do Autentique no momento da criação do documento (ajuste na mutation GraphQL: incluir `signatures { link { short_link } }` no retorno do `createDocument`).
2. Extrair o slug (`short_link` chega como `https://assina.ae/XYZ123` — pegar só `XYZ123`).
3. Chamar a função `whatsapp-meta-send-template` (existente, usada pelos outros templates do sistema) em vez de `whatsapp-send-text`, com:
   - `template_name: 'assinatura_documento_v2'`
   - `idioma: 'pt_BR'`
   - `variaveis_corpo: [primeiroNome, 'Termo de Cancelamento - Troca de Titularidade']`
   - `variaveis_botao_url: [slugAutentique]`
   - `telefone: associadoAntigo.telefone`
   - `referencia_tipo: 'troca_titularidade'`, `referencia_id: solicitacao_id`
4. Manter persistência de `termo_whatsapp_status` (`enviado` | `falhou` | `sem_telefone`).
5. Fallback: se `whatsapp-meta-send-template` falhar **e** o provedor configurado for Evolution (não Meta), tentar `whatsapp-send-text` como antes — para não regredir contas que ainda usam Evolution.

### 2. Verificar nome real da edge function de envio Meta

Antes de codar, confirmar o nome (`whatsapp-meta-send` / `whatsapp-meta-send-template` / outro) listando `supabase/functions/whatsapp-meta-*` e o payload aceito (alguns projetos aceitam `componentes` Meta direto, outros aceitam apenas `variaveis`).

### 3. Reenviar/Reaplicar para a solicitação atual

Após o fix, usar o botão "Reenviar" (já existente no card "Termo de Cancelamento") na solicitação `31330683…` do Marcus Vinicius para validar que o WhatsApp chega.

## Não escopo

- Não criar template novo no Meta (o `assinatura_documento_v2` já existe e foi aprovado).
- Não alterar o conteúdo do e-mail Autentique nem o fluxo de assinatura facial.
- Não mexer no provedor configurado (Meta vs Evolution) — apenas adaptar a função para respeitar a Meta.
