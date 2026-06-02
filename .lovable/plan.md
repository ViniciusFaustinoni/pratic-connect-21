## Objetivo

Mostrar, ao lado do título **"Conversas IA"** (em `/eventos/chat-ia`), um badge com o número de telefone do WhatsApp da IA — o mesmo número configurado em Integrações › WhatsApp Business (provedor Meta Oficial).

## Onde fica hoje

- Título: `src/components/eventos/chat-ia/ConversasList.tsx` (linha 103-114), logo após o badge de contagem (`232`) e antes do badge "não lidas".
- O número da IA hoje **não está persistido** em `whatsapp_meta_config` — só é exibido em um toast ao clicar "Testar conexão" (`whatsapp-meta-test` retorna `display_phone_number` da Graph API).

## Mudanças

### 1. Persistir o número na config (1 coluna nova)

Migração: adicionar `display_phone_number text` em `whatsapp_meta_config`.

Atualizar `supabase/functions/whatsapp-meta-test/index.ts` para gravar `display_phone_number: result.display_phone_number` no UPDATE existente (linhas 69-76) — assim toda vez que alguém testa, o número fica salvo.

Backfill leve: na primeira renderização da tela, se `display_phone_number` for `null` e existir `phone_number_id`, disparar `whatsapp-meta-test` em background uma vez para popular (não-bloqueante, sem toast).

### 2. Exibir o badge

Em `ConversasList.tsx`, usar o hook já existente `useMetaConfig()` (de `src/hooks/useWhatsAppMeta.ts`) e renderizar um badge novo entre o badge `232` e o "não lidas":

```tsx
{metaConfig?.display_phone_number && (
  <Badge variant="outline" className="text-[10px] font-mono">
    {formatBR(metaConfig.display_phone_number)}
  </Badge>
)}
```

- Formato: aplicar máscara `+55 (21) 98579-1044` via util simples inline (o Graph API devolve no formato `+55 21 98579-1044` ou similar).
- Estilo: `variant="outline"` para não competir visualmente com o badge verde de não lidas.
- Tooltip opcional: "Número WhatsApp da IA".

### 3. Sem mudanças em outros lugares

- Não toca `ChatPanel`, `ContatoDetalheDrawer`, hooks de conversas.
- Não muda lógica de envio nem de IA.
- Continua funcionando se o provedor ativo for Evolution (badge simplesmente não aparece — fallback silencioso).

## Arquivos tocados

- `supabase/migrations/<timestamp>_meta_config_display_phone.sql` (novo)
- `supabase/functions/whatsapp-meta-test/index.ts` (gravar display_phone_number)
- `src/components/eventos/chat-ia/ConversasList.tsx` (badge + hook)

## Fora de escopo

- Exibir número da Evolution (provedor secundário).
- Editar/forçar atualização manual do número via UI — fica restrito ao botão "Testar" existente.
