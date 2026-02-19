
# Corrigir: IA do App não gera nem renderiza o Link do Evento na conversa

## Problema

Quando o associado comunica um sinistro via chat no app, a IA cria o sinistro no banco, mas:

1. **Nao gera o Link do Evento** -- a edge function `assistente-chat` nunca chama `gerar-link-evento` apos criar o sinistro. O `[LINK_AUTO_VISTORIA]` e apenas um marcador de texto no prompt, sem acao real.
2. **Nao renderiza nada no chat** -- `ChatMessage.tsx` detecta `[BOTAO_LOCALIZACAO]`, `[UPLOAD_BO]` e `[UPLOAD_FOTOS]`, mas **ignora completamente** `[LINK_AUTO_VISTORIA]`. O marcador aparece como texto puro ou e removido pelo admin view, mas nao existe componente para ele no app.

## Solucao

### 1. Backend: Gerar link automaticamente apos criar sinistro

**Arquivo:** `supabase/functions/assistente-chat/index.ts`

Apos o INSERT do sinistro (linha ~654, apos log "Sinistro criado"), adicionar logica para gerar o link do evento diretamente (sem chamar `gerar-link-evento`, pois essa funcao exige JWT de admin). O codigo usara o `supabase` com service role que ja existe na funcao:

```text
// Apos criar sinistro com sucesso:
// Invalidar links anteriores
await supabase.from('sinistro_evento_links')
  .update({ status: 'invalidado' })
  .eq('sinistro_id', sinistroChat.id)
  .eq('status', 'ativo');

// Criar novo link (72h)
const expiraLink = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
const { data: novoLink } = await supabase
  .from('sinistro_evento_links')
  .insert({ sinistro_id: sinistroChat.id, expira_em: expiraLink, status: 'ativo', etapa_atual: 0 })
  .select('id, token')
  .single();

// Vincular ao sinistro
if (novoLink) {
  await supabase.from('sinistros')
    .update({ link_evento_id: novoLink.id })
    .eq('id', sinistroChat.id);
}
```

O token do link sera incluido no retorno da tool para que a IA possa referencia-lo e o frontend possa renderizar.

### 2. Backend: Retornar token no resultado da tool

Alterar o `return` da tool `criar_solicitacao_sinistro` para incluir o token:

```text
return JSON.stringify({
  sucesso: true,
  protocolo: protocoloChat,
  message: "...",
  id: sinistroChat.id,
  link_evento_token: novoLink?.token || null,
});
```

### 3. Backend: Retornar dados estruturados na resposta da edge function

Alterar a resposta final da edge function para incluir metadados alem do `content`:

```text
return new Response(JSON.stringify({
  content: finalContent,
  toolsUsed: [...],
  linkEventoToken: linkToken, // Token capturado durante execucao das tools
}));
```

Para isso, manter uma variavel `linkEventoToken` no escopo do loop de tools que e preenchida quando `criar_solicitacao_sinistro` retorna com sucesso.

### 4. Frontend: Criar componente `EventoLinkButton`

**Novo arquivo:** `src/components/app/chat/EventoLinkButton.tsx`

Componente que renderiza um botao/card dentro do chat redirecionando o associado para a pagina `/evento/:token`:

```text
- Botao com icone de link externo
- Texto: "Acessar Link do Evento"
- Subtexto: "Envie fotos, B.O. e relato"
- Ao clicar: navega para /evento/{token} (mesma SPA)
```

### 5. Frontend: Detectar e renderizar `[LINK_AUTO_VISTORIA]` no ChatMessage

**Arquivo:** `src/components/app/chat/ChatMessage.tsx`

- Adicionar deteccao de `[LINK_AUTO_VISTORIA]` (semelhante aos outros marcadores)
- Remover marcador do texto exibido
- Renderizar `EventoLinkButton` abaixo do texto quando detectado
- Receber `linkEventoToken` como prop opcional

### 6. Frontend: Passar token do link pelo hook

**Arquivo:** `src/hooks/useAssistenteChat.ts`

- Apos receber resposta da edge function, extrair `linkEventoToken` do `data`
- Armazenar no estado da mensagem (expandir `ChatMessage` interface com campo opcional `linkEventoToken`)
- Passar para `ChatMessage` via props

**Arquivo:** `src/pages/app/AppChat.tsx`

- Passar `linkEventoToken` de cada mensagem para o componente `ChatMessage`

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/assistente-chat/index.ts` | Gerar link evento apos criar sinistro; retornar token na resposta |
| `src/components/app/chat/EventoLinkButton.tsx` | **Novo** -- componente de botao para link do evento |
| `src/components/app/chat/ChatMessage.tsx` | Detectar `[LINK_AUTO_VISTORIA]` e renderizar `EventoLinkButton` |
| `src/hooks/useAssistenteChat.ts` | Extrair e armazenar `linkEventoToken` da resposta |
| `src/pages/app/AppChat.tsx` | Passar `linkEventoToken` para ChatMessage |

## Resultado esperado

1. Associado relata sinistro no chat do app
2. IA cria sinistro no banco com status `comunicado`
3. Link do evento e gerado automaticamente (72h de validade)
4. A IA responde com instrucoes e o marcador `[LINK_AUTO_VISTORIA]`
5. No chat, aparece um botao estilizado "Acessar Link do Evento"
6. Ao clicar, o associado e redirecionado para `/evento/{token}` onde completa as 3 etapas (fotos, B.O., relato)
