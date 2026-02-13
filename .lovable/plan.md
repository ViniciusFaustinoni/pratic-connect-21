
# Melhorias na Analise de Sinistro: Reprovacao com IA, Link Unico de Documentos

## Resumo

Tres funcionalidades para a tela de analise de sinistro:

1. **Reprovacao com notificacao via IA**: Ao reprovar, o motivo digitado no modal e enviado ao associado via WhatsApp com uma mensagem formatada pela IA
2. **Solicitar documentos com link unico**: Gera um token/link publico que o associado acessa para fazer upload apenas dos documentos faltantes. O link expira quando todos os documentos sao enviados
3. **Documentos enviados pelo link aparecem na tela de analise**: Os uploads feitos pelo associado via link publico sao exibidos em tempo real na mesma tela

---

## Detalhamento Tecnico

### 1. Reprovacao com envio de motivo via IA

**O que ja existe**: O `ReprovarSinistroDialog` ja tem campo de motivo (select) e justificativa (textarea), e a edge function `reprovar-sinistro` ja envia WhatsApp com mensagem fixa.

**Alteracao**: A mensagem WhatsApp ja inclui o motivo e justificativa digitados. Nenhuma mudanca necessaria no dialog - ele ja obriga os dois campos. A edge function ja monta a mensagem com `motivoLabel` e `justificativa`. Isso **ja funciona como solicitado**.

Confirmacao: o campo de texto (justificativa) ja e obrigatorio no dialog (botao desabilitado se vazio). A mensagem enviada ja contem o motivo formatado. **Nenhuma alteracao necessaria nesta parte.**

### 2. Link unico para envio de documentos

**Alteracoes no banco de dados:**

- Adicionar coluna `upload_token` (text, unique, nullable) na tabela `sinistros` para o token unico
- Adicionar coluna `upload_token_expires_at` (timestamptz, nullable) para controlar expiracao

**Nova pagina publica**: `src/pages/public/UploadDocumentosSinistro.tsx`
- Rota: `/sinistro/documentos/:token`
- Busca o sinistro pelo `upload_token`
- Verifica se o token nao expirou e se ainda ha documentos pendentes
- Lista apenas os documentos com status `pendente`
- Para cada documento, exibe area de upload (drag-and-drop)
- Ao enviar todos, marca o token como expirado (ou remove)
- Upload vai para o bucket `sinistros` (ja existe, publico=false)

**Alteracao no `SolicitarDocumentosSinistroDialog`:**
- Apos inserir os documentos pendentes, gerar um `upload_token` (UUID curto) e salvar no sinistro
- Montar o link `{origin}/sinistro/documentos/{token}`
- Enviar via WhatsApp com o link

**Nova edge function**: `supabase/functions/upload-documento-sinistro/index.ts`
- Recebe `token` e arquivo (FormData)
- Valida o token, verifica expiracao
- Faz upload para o bucket `sinistros`
- Atualiza `sinistro_documentos` com a URL e status `enviado`
- Se todos os documentos foram enviados, remove/expira o token e atualiza status do sinistro para `em_analise`

**Rota no App.tsx:**
- Adicionar `<Route path="/sinistro/documentos/:token" element={<UploadDocumentosSinistro />} />`

### 3. Documentos enviados aparecem na tela de analise

A tela de analise (`SinistroAnalise.tsx`) ja exibe documentos via `useSinistroAnalise` que busca `sinistro_documentos`. Quando o associado faz upload pelo link publico e o documento e atualizado no banco, basta invalidar/recarregar a query. Como ja existe Realtime em outras partes do sistema, adicionaremos um listener Realtime na tabela `sinistro_documentos` para atualizar automaticamente quando novos documentos chegarem.

---

## Arquivos a criar/modificar

| Arquivo | Tipo | Descricao |
|---|---|---|
| Migration SQL | Criar | Adicionar `upload_token` e `upload_token_expires_at` em `sinistros` |
| `src/components/sinistros/SolicitarDocumentosSinistroDialog.tsx` | Modificar | Gerar token, salvar no sinistro, incluir link na mensagem WhatsApp |
| `supabase/functions/upload-documento-sinistro/index.ts` | Criar | Edge function para receber uploads do associado via token publico |
| `src/pages/public/UploadDocumentosSinistro.tsx` | Criar | Pagina publica de upload de documentos para o associado |
| `src/App.tsx` | Modificar | Adicionar rota `/sinistro/documentos/:token` |
| `supabase/config.toml` | Modificar | Adicionar config da nova edge function |
| `src/hooks/useSinistroAnalise.ts` | Modificar | Adicionar Realtime listener para `sinistro_documentos` para atualizar a tela automaticamente |

## Fluxo do associado

```text
Analista clica "Solicitar Documentos"
  -> Seleciona documentos faltantes
  -> Sistema gera token unico e salva no sinistro
  -> WhatsApp enviado com link: /sinistro/documentos/{token}

Associado abre o link
  -> Ve lista de documentos pendentes
  -> Faz upload de cada um
  -> Ao concluir todos, token expira
  -> Status do sinistro volta para "em_analise"

Analista ve na tela de analise
  -> Documentos aparecem automaticamente (Realtime)
  -> Checklist atualiza
```

## Observacao sobre a reprovacao

A funcionalidade de reprovacao **ja esta implementada corretamente**: o modal ja exige motivo e justificativa, e a edge function ja envia a mensagem via WhatsApp com o motivo formatado. Nao ha necessidade de alteracao nesta parte.
