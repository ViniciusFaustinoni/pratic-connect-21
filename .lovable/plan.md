

## Plano: Tela Publica de Assinatura do Checklist

### Contexto
Atualmente, apos a conclusao da instalacao, o sistema envia o laudo PDF diretamente para o Autentique e o link de assinatura via WhatsApp. Porem, o associado nao tem a oportunidade de **revisar** o que foi feito (checklist, avarias, fotos) antes de assinar. A pagina `/acompanhar/:token` tem apenas um SignaturePad simples, sem conteudo informativo.

O objetivo e criar uma pagina publica dedicada onde o associado possa visualizar tudo o que foi registrado na instalacao antes de ser redirecionado para assinar o laudo no Autentique.

### O que sera feito

**1. Nova pagina publica: `/checklist-instalacao/:token`**
- Arquivo: `src/pages/public/ChecklistInstalacaoPublica.tsx`
- Busca dados do servico via `link_token` do contrato (mesmo token ja usado no `/acompanhar/:token`)
- Exibe 3 secoes:
  - **Checklist de Servicos**: Renderiza `checklist_data` do servico com status de cada item (OK/NOK/ressalva)
  - **Avarias Identificadas**: Exibe `ressalvas_instalador` e fotos de ressalva (`fotos_ressalva`) se houver
  - **Midia Visual**: Galeria de fotos da vistoria (`vistoria_fotos`) filtradas por `visivel_cliente = true` (exclui fotos da categoria `instalacao` — local fisico do rastreador). Inclui video 360 se existir
- Ao final, botao "Assinar Laudo de Instalacao" que redireciona para o link do Autentique (`laudo_autentique_url` do servico)
- Se o laudo ja foi assinado (`laudo_assinado = true`), exibe mensagem de confirmacao

**2. Rota em `App.tsx`**
- Adicionar rota `/checklist-instalacao/:token` com lazy import

**3. Alterar link do WhatsApp pos-instalacao**
- Em `src/hooks/useServicos.ts` (`useAprovarVeiculoServico`), alterar a mensagem enviada via WhatsApp:
  - Em vez de enviar diretamente o link do Autentique, enviar o link para `/checklist-instalacao/:token`
  - O associado primeiro visualiza o checklist na pagina publica, depois clica para assinar no Autentique
  - Manter o template `assinatura_documento_v2` com o novo link

**4. Envio do laudo por email apos assinatura**
- No `autentique-webhook/index.ts`, quando detectar que o laudo foi assinado, alem de atualizar `laudo_assinado`, enviar email ao associado com link para download do PDF assinado
- Usar `send-email` (edge function existente) com template `generico`

### Fluxo
```text
Tecnico conclui instalacao
  → Laudo PDF gerado + enviado ao Autentique
  → WhatsApp com link /checklist-instalacao/:token
    → Associado abre link
      → Ve checklist, avarias, fotos/videos
      → Clica "Assinar Laudo"
        → Redirecionado ao Autentique
          → Assina digitalmente
            → Webhook atualiza laudo_assinado
            → Email com PDF assinado enviado ao associado
```

### Arquivos
- **Criar**: `src/pages/public/ChecklistInstalacaoPublica.tsx`
- **Editar**: `src/App.tsx` (nova rota)
- **Editar**: `src/hooks/useServicos.ts` (link do WhatsApp)
- **Editar**: `supabase/functions/autentique-webhook/index.ts` (envio de email)

