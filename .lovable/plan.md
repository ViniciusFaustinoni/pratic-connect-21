## Objetivo

Dar credibilidade visual aos e-mails de suspensão:
1. Editor do corpo igual ao de **Documentos** (Tiptap, mesma toolbar/abas), salvando HTML real.
2. Todo e-mail é envelopado automaticamente no **layout institucional Praticcar** (cabeçalho azul, miolo, rodapé com CNPJ) — operador edita só o miolo.

## Mudanças

### 1. Coluna `formato` no template (migration)
- `email_suspensao_templates.formato text default 'html'` (`'html' | 'texto'`). Templates antigos viram `'texto'` no backfill para preservar render `pre-wrap` atual.
- Sem alterações estruturais nem em `email_suspensao_envios` (já guarda `corpo_renderizado` como string).

### 2. Editor visual — `TemplateEditor.tsx` e `TemplateEditorDialog.tsx`
Trocar o `<Textarea>` por um **EmailEditor** novo em `src/pages/relacionamento/emails/components/EmailBodyEditor.tsx`, modelado no editor de Documentos:
- Tiptap (`StarterKit + Underline + TextAlign + Table + Placeholder`)
- Toolbar reaproveitada do `documentos/tiptap/EditorToolbar` (negrito, itálico, cor, alinhamento, listas, link, tabela)
- Abas **Visual / HTML / Preview** (mesmo padrão de Documentos)
- Botões "Inserir variável" continuam funcionando (inserem `{{var}}` na posição do cursor do Tiptap)
- `onChange` devolve HTML; salva em `corpo` + grava `formato='html'`
- Para templates legados (`formato='texto'`), abre em modo compatível: editor mostra texto convertido em `<p>`s preservando quebras, mas o usuário pode promover para HTML salvando.

### 3. Wrapper institucional (sempre aplicado no envio)
Novo arquivo `supabase/functions/_shared/email-layout-praticcar.ts` exporta `envelopeEmailPraticcar({ assunto, corpoHtml })` que devolve HTML completo inspirado no `termo-afiliacao-template.ts`:
- `<!doctype html>` + estilos inline email-safe (tabela 600px centralizada — não `@page`/A4)
- Header azul `#1e40af` com nome "Praticcar Proteção Veicular" centralizado
- Corpo branco com o HTML do template injetado (sem escape)
- Rodapé cinza com CNPJ, endereço, "Este é um e-mail automático — não responda" e nota "Em caso de dúvidas, fale conosco pelo WhatsApp"
- Compatível com Gmail/Outlook (tabelas + inline styles, fontes Arial)

### 4. `enviarEmailSuspensao.ts`
- Substituir `corpoParaHtml(corpoRender)` por:
  - se `tpl.formato === 'html'`: usar `corpoRender` cru
  - se `'texto'`: manter `escapeHtml + pre-wrap` (compat retro)
- Envelopar SEMPRE pelo `envelopeEmailPraticcar({ assunto: assuntoRender, corpoHtml: miolo })` antes de mandar pro Resend.
- `corpo_renderizado` gravado em `email_suspensao_envios` continua sendo só o miolo (auditoria leve). O HTML final completo não é persistido (pode ser regenerado).

### 5. Preview na tela do template
- `renderTemplateEmailSuspensao` / `renderPreview` passam a renderizar o **envelope completo** num `<iframe srcDoc>` (igual a Documentos faz com o termo), para o operador ver exatamente o que o cliente vê.

## Não muda
- WhatsApp paralelo
- Tabelas `email_suspensao_envios`, `email_suspensao_config`
- Fluxos do cron (suspensão por inadimplência / não-instalação) — só passa a chamar o helper já atualizado
- Toggle global e toggle por template
- Edição de assunto (segue Input simples)

## Deploy

1. Migration `formato`
2. Front: `EmailBodyEditor` + ajuste em `TemplateEditor.tsx`, `TemplateEditorDialog.tsx`, preview iframe
3. Edge: `email-layout-praticcar.ts` + ajuste em `enviarEmailSuspensao.ts`
4. Re-deploy de `cron-suspender-inadimplentes` e `cron-suspender-cobertura-inativacao` (não muda código deles, só puxam o helper atualizado)
