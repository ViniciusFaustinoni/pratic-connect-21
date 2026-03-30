

# Corrigir Template `assinatura_instalacao_v1` — Tabela Errada

## Problema
O template foi inserido na tabela `whatsapp_templates` (templates internos do sistema), mas a tela de "Templates Meta" na configuração do WhatsApp lista da tabela `whatsapp_meta_templates` (templates da API Oficial Meta). Por isso não aparece na lista.

## Solução

1. **Inserir o template na tabela correta** (`whatsapp_meta_templates`) com os campos adequados:
   - `nome`: `assinatura_instalacao_v1`
   - `categoria`: `UTILITY`
   - `idioma`: `pt_BR`
   - `status`: `DRAFT`
   - `corpo`: mensagem com variáveis `{{1}}`, `{{2}}`, `{{3}}` (padrão Meta)
   - `botoes`: botão CTA com URL para o link de acompanhamento
   - `variaveis_exemplo`: exemplos para cada variável

2. **Manter o registro em `whatsapp_templates`** — ele é usado internamente pelo hook `useWhatsAppTemplates` e pelo `SeletorTemplate`, então não há conflito.

3. **Atualizar `useServicos.ts`** — na parte que envia o WhatsApp após a instalação, referenciar o template Meta (via edge function `whatsapp-send-template` ou similar) em vez de `whatsapp-send-text` com mensagem livre, para conformidade com a API Oficial Meta.

| Arquivo | Ação |
|---|---|
| Migration SQL | INSERT em `whatsapp_meta_templates` com dados corretos (UTILITY, pt_BR, DRAFT) |
| `src/hooks/useServicos.ts` | Ajustar envio pós-instalação para usar template Meta se disponível |

