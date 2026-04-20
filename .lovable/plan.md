

## Envio do Termo de Filiação via WhatsApp Meta (template + link Autentique)

### Diagnóstico

- O contrato (Termo de Afiliação) é gerado pela edge function `autentique-create-by-token`, que salva em `contratos.autentique_url` o link curto da Autentique no formato `https://assina.ae/<token>`.
- Já existe um **template Meta APROVADO** chamado `assinatura_documento_v2` com:
  - Corpo: 2 variáveis (`{{1}}` = primeiro nome, `{{2}}` = nome do documento)
  - Botão URL dinâmico: `https://assina.ae/{{1}}` (1 variável de botão = token Autentique)
- O envio via WhatsApp foi removido do fluxo (`// WhatsApp template sending removed - link is now shown directly on the public page`). Falta reativar.
- A infra para enviar templates Meta com botão URL dinâmico já existe em `whatsapp-send-text` (suporta `template_button_params`).

### Solução

#### 1. Garantir que o template oficial existe e está aprovado
Já existe `assinatura_documento_v2` APPROVED. Nenhuma criação nova necessária — apenas vamos referenciá-lo.

Como o usuário pediu explicitamente para "criar um template Meta no formato de envio de link", vou criar uma variante v3 dedicada **especificamente ao Termo de Filiação** (mais alinhada ao contexto, sem genérico de "documento"), via SQL insert na tabela `whatsapp_meta_templates` com status `DRAFT`. O usuário envia para a Meta pelo botão "Enviar para aprovação" da aba Templates Meta.

```text
nome:       termo_filiacao_assinatura_v1
categoria:  UTILITY
header:     none
corpo:
  Olá {{1}}! 📄
  
  Seu *Termo de Filiação PRATIC* está pronto para assinatura digital.
  
  Veículo: *{{2}}*
  Contrato: {{3}}
  
  Clique no botão abaixo para ler e assinar com validade jurídica.
  Após a assinatura, sua proteção será ativada.
rodape:     Equipe PRATIC 🛡️
botão URL:  "Assinar Termo"  →  https://assina.ae/{{1}}
variáveis exemplo: { "1": "João", "2": "HB20 - ABC1234", "3": "PRT-2026-001234" }
```

Enquanto este novo template não estiver aprovado, o sistema usa automaticamente o já aprovado `assinatura_documento_v2` como fallback (lógica de seleção descrita abaixo).

#### 2. Helper compartilhado (reusável)
Criar `supabase/functions/_shared/enviar-termo-filiacao-whatsapp.ts` com a função:

```ts
enviarTermoFiliacaoWhatsApp(supabase, {
  contratoId,
  telefone,
  nomeCompleto,
  veiculoLabel,   // "HB20 - ABC1234"
  numeroContrato,
  autentiqueUrl,  // https://assina.ae/<token>
})
```

Lógica:
- Extrai o token do final da URL (`url.split('/').pop()`).
- Procura template aprovado nesta ordem: `termo_filiacao_assinatura_v1` → `assinatura_documento_v2`.
- Monta `template_params` conforme o template encontrado (3 params no novo, 2 no fallback usando "Termo de Afiliação Nº X").
- Chama `whatsapp-send-text` com `template_name`, `template_params`, `template_button_params: [token]`, `referencia_tipo: 'termo_filiacao'`, `referencia_id: contratoId`.
- Faz log estruturado e nunca quebra o fluxo principal (try/catch silencioso).

#### 3. Reativar o envio em `autentique-create-by-token`
Após o `update` que grava `autentique_url` no contrato (linha ~788), chamar o helper acima usando o telefone do `lead`/`associado`. Substituir o comentário "WhatsApp template sending removed".

Mesmo tratamento na edge function `autentique-create` (fluxo interno do CRM, quando admin envia manualmente).

#### 4. Botão manual na UI (Reenviar por WhatsApp)
Em `src/components/contratos/ContratoDetailDrawer.tsx` (gaveta de detalhes do contrato), adicionar botão **"Reenviar link por WhatsApp"** visível quando `autentique_url` existe e contrato está `pendente_assinatura`. Chama uma nova edge function leve `enviar-termo-filiacao-whatsapp` (wrapper público do helper) com `contratoId`.

#### 5. Migration
Inserir o template novo como DRAFT:

```sql
INSERT INTO whatsapp_meta_templates
  (nome, categoria, idioma, status, header_tipo, corpo, rodape, botoes, variaveis_exemplo)
VALUES (
  'termo_filiacao_assinatura_v1', 'UTILITY', 'pt_BR', 'DRAFT', 'none',
  'Olá {{1}}! 📄\n\nSeu *Termo de Filiação PRATIC* está pronto para assinatura digital.\n\nVeículo: *{{2}}*\nContrato: {{3}}\n\nClique no botão abaixo para ler e assinar com validade jurídica.\nApós a assinatura, sua proteção será ativada.',
  'Equipe PRATIC 🛡️',
  '[{"tipo":"url","texto":"Assinar Termo","url":"https://assina.ae/{{1}}"}]'::jsonb,
  '{"1":"João","2":"HB20 - ABC1234","3":"PRT-2026-001234"}'::jsonb
)
ON CONFLICT (nome) DO NOTHING;
```

### Arquivos tocados

**Novos**
- `supabase/migrations/<timestamp>_template_termo_filiacao.sql` — insert do template DRAFT.
- `supabase/functions/_shared/enviar-termo-filiacao-whatsapp.ts` — helper reusável.
- `supabase/functions/enviar-termo-filiacao-whatsapp/index.ts` — wrapper público (para botão manual da UI).

**Editados**
- `supabase/functions/autentique-create-by-token/index.ts` — reativa envio WhatsApp pós-criação do link.
- `supabase/functions/autentique-create/index.ts` — idem para o fluxo interno.
- `src/components/contratos/ContratoDetailDrawer.tsx` — botão "Reenviar por WhatsApp" (com toast de sucesso/erro).
- `supabase/config.toml` — registrar a nova edge function (verify_jwt = false para uso público com auth do usuário).

### Validação

1. Aba **Configurações → WhatsApp → Templates Meta**: novo template `termo_filiacao_assinatura_v1` aparece como DRAFT, com prévia mostrando o botão "Assinar Termo".
2. Clicar em "Enviar para aprovação" → status muda para PENDING (Meta vai aprovar/rejeitar).
3. Concluir um pagamento de adesão real (ou usar contrato do ALEX) → fluxo público gera o `autentique_url` → cliente recebe no WhatsApp **imediatamente** uma mensagem com o template `assinatura_documento_v2` (fallback enquanto o novo não está aprovado), botão "Assinar agora" levando ao link Autentique correto.
4. Em `Vendas → Contratos`, abrir um contrato `pendente_assinatura` → clicar **"Reenviar por WhatsApp"** → toast de sucesso, mensagem chega novamente, registro aparece em `whatsapp_mensagens` com `referencia_tipo='termo_filiacao'` e `referencia_id=<contratoId>`.
5. Após `termo_filiacao_assinatura_v1` ser aprovado pela Meta, novos envios passam a usar este template automaticamente (sem mudança de código).
6. Não há regressão: contratos sem WhatsApp cadastrado não quebram o fluxo (helper apenas loga e segue).

