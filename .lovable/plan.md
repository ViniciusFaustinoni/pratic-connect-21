## Diagnóstico

Caso real (Marcus Vinicius / LTB4J74, solicitação `6c62b7c0…`):

1. `enviar-termo-cancelamento-troca` cria o documento no Autentique → OK.
2. Tenta extrair o `slugAutentique` (a partir de `signatures[].link.short_link` contendo `assina.ae`) → **vem `null`** no momento da criação (a Autentique nem sempre devolve o short link no mesmo response). Log esperado: *"short_link Autentique não retornado — pulando Meta"*.
3. Como Meta foi pulada, cai no fallback Evolution (`whatsapp-send-text` com texto livre) → bloqueado pelo gateway: `"Bloqueado: Meta API ativa requer template_name. Texto livre não é entregue fora da janela 24h."` (registrado em `whatsapp_mensagens` → status `erro`).
4. `waStatus` vai pra `'falhou'` e o modal mostra "WhatsApp: falhou".

A configuração Meta (`whatsapp_meta_config`) está OK (token + phone_id presentes), o problema é só a ausência do slug no momento do envio.

## Correção

**Arquivo:** `supabase/functions/enviar-termo-cancelamento-troca/index.ts`

1. **Resolver o slug com robustez** (antes de pular Meta):
   - Se `shortLinkRaw` não veio no response inicial, fazer uma query GraphQL de follow-up `query { document(id: $id) { signatures { public_id link { short_link } } } }` (com 1–2 retries de ~1.5s). Reextrair `short_link` contendo `assina.ae`.
   - Se ainda assim não vier, usar **`public_id` da signature como slug** (template `assinatura_documento_v2` URL é `https://assina.ae/{{1}}` — `assina.ae/{public_id}` resolve para o mesmo destino).
   - Só se nem `public_id` existir, marcar como falha.

2. **Remover o fallback Evolution texto livre** (linhas ~341-357): com Meta como provedor oficial, esse caminho está garantido a falhar fora da janela 24h e ainda polui `whatsapp_mensagens`. Substituir por: se Meta não pôde enviar (sem slug/sem config), marcar `waStatus = 'falhou'` com erro descritivo no `whatsapp_mensagens` e seguir (Autentique já mandou e-mail).

3. **Logging**: incluir motivo específico no `console.warn` e no campo `erro_mensagem` da `whatsapp_mensagens` (`autentique_short_link_indisponivel`, `meta_config_ausente`, ou erro retornado pela Graph API) para facilitar debugging futuro.

4. **Reenvio retroativo**: após o deploy, o usuário pode clicar em "Reenviar termo" no modal — a função vai recriar o doc e disparar a Meta corretamente. Não precisa de backfill manual.

## Fora de escopo

- Mudar provedor padrão / janela 24h.
- Mexer em outros fluxos que usam `whatsapp-send-text`.
- UI do modal (a label "falhou" passa a refletir corretamente quando Meta também falhar).
