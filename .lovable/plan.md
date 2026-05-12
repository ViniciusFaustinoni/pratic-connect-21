## Diagnóstico — KOU6D37 (Marcos Dativo → Marcus Vinicius)

### O que aconteceu
- Solicitação `c3325fd9-d7ae-4617-b9ee-8e5dde81c317` gerou doc Autentique `75e02285…774493c5e`.
- A mensagem WhatsApp recebida pelo associado (template `assinatura_documento_v2`) trouxe o botão "Assinar Agora" apontando para `https://assina.ae/24493ba74e1811f1bb8342010a2b6020` → **404**.
- O slug `24493ba7…2b6020` tem **32 chars hex** = é o `signatures[].public_id` retornado pelo Autentique. **Não é** o `short_link` real.

### Causa raiz
A função `extractSlug` (em `enviar-termo-cancelamento-troca`, `enviar-termo-cancelamento-substituicao`) cai num *fallback* errado quando `signatures[0].link.short_link` ainda não foi populado pelo Autentique:

```ts
// Fallback: usa public_id (assina.ae/{public_id} resolve para a página de assinatura)
const pid = signatures.map(s => s?.public_id).find(p => typeof p === 'string' && p.length > 0);
return pid || null;
```

A premissa está errada: `assina.ae/{public_id}` **não resolve** — apenas `assina.ae/{short_link slug}` (geralmente 8 chars) funciona. Quando o Autentique demora a popular `link.short_link` (ocorre com PF_FACIAL recém-criado), o slug enviado é o public_id e a URL quebra.

O mesmo bug existe em `_shared/enviar-termo-filiacao-whatsapp.ts` — `extrairToken` pega o último segmento da URL (que pode ser o `docId` de 50 chars) e injeta em `https://assina.ae/{{1}}`, resultando em 404.

### Correção (escopo)
1. **Remover fallback inseguro para `public_id`** em `extractSlug`/`extrairToken`. Se `short_link` indisponível após retries, **não enviar** o template com botão — caímos para template texto (`n` ou Evolution) com a URL `app.autentique.com.br/documentos/{docId}`, que sempre funciona.
2. **Aumentar resiliência do follow-up Autentique**: subir de 2 para 4 tentativas com backoff (1.5s → 3s → 5s → 8s), totalizando ~17s — Autentique normalmente popula `short_link` em até 10s para PF_FACIAL.
3. **Endurecer validação do slug** antes de montar o botão: aceitar apenas strings de 6–16 chars alfanuméricos (formato típico do assina.ae). Qualquer coisa fora disso → fallback texto.
4. Aplicar a mesma correção nos três arquivos:
   - `supabase/functions/enviar-termo-cancelamento-troca/index.ts`
   - `supabase/functions/enviar-termo-cancelamento-substituicao/index.ts`
   - `supabase/functions/_shared/enviar-termo-filiacao-whatsapp.ts`
5. **Logar `whatsapp_mensagens` mesmo quando cair no fallback texto**, com `template_id='fallback_texto_short_link_indisponivel'` para auditoria/alerta.

### Reenvio para o caso atual (KOU6D37)
Após o deploy, reenviar via UI (Modal de Detalhes da Troca → "Reenviar termo de cancelamento"). A função detecta `force_resend=true`, deleta o doc anterior no Autentique e cria um novo — agora com short_link válido OU URL Autentique completa em texto.

### O que NÃO mudará
- Lógica de geração do PDF, template do Termo, fluxo de assinatura PF_FACIAL, persistência do `termo_cancelamento_url` no banco.
- Comportamento da função para casos em que `short_link` chega normalmente (maioria).

### Arquivos editados
- `supabase/functions/enviar-termo-cancelamento-troca/index.ts`
- `supabase/functions/enviar-termo-cancelamento-substituicao/index.ts`
- `supabase/functions/_shared/enviar-termo-filiacao-whatsapp.ts`
