## Objetivo

Permitir que o Cadastro solicite **reenvio do Vídeo 360°** da autovistoria via o modal "Solicitar Reenvio". Hoje só é possível pedir fotos e documentos.

## Causa raiz

O modal `SolicitarDocumentosDialog.tsx` lista apenas itens de fotos (9 itens da autovistoria legada) e documentos pessoais. Nenhum item representa o vídeo 360°, embora o vídeo seja parte canônica da autovistoria (chassi + motor + vídeo 360°).

Além disso, o pipeline público (`DocumentosPendentesPublico.tsx`) só aceita `image/*` e `.pdf` e grava em `documentos`, sem caminho para gravar `vistorias.video_360_url`. O enum `tipo_documento` também não tem o valor `video_360`.

## Plano

### 1. Banco — adicionar valor ao enum
Migration: `ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'video_360';`

### 2. Modal de solicitação (`src/components/cadastro/SolicitarDocumentosDialog.tsx`)
- Adicionar nova **categoria "Vídeo da Autovistoria"** (ícone `Video`) com 1 item:
  - `{ id: 'video_360', label: 'Vídeo 360° do veículo (finalizando com painel ligado)' }`
- Categoria aparece tanto no fluxo `isAutovistoria=true` quanto no presencial (instalador também grava vídeo 360°).
- Abrir essa categoria por padrão quando `isAutovistoria=true`.

### 3. Hook de mapeamento (`src/hooks/useDocumentosSolicitados.ts`)
- Adicionar `'video_360': 'Vídeo 360° do Veículo'` em `TIPO_DOCUMENTO_LABELS`.
- Adicionar `video_360` ao tipo `TipoDocumentoEnum` e ao mapping de `mapTipoSolicitadoParaEnum`.

### 4. Link público de reenvio (`src/components/cotacao-publica/DocumentosPendentesPublico.tsx`)
- Adicionar label `'video_360': 'Vídeo 360° do Veículo'` e helper `isTipoVideo(tipo)`.
- Quando `tipo_documento === 'video_360'`:
  - Input com `accept="video/*"` + `capture="environment"` + dica de instruções (terminar no painel ligado com motor funcionando).
  - No `enviarDocumento`: pular OCR; após upload no bucket `cotacoes-docs`:
    1. Localizar a `vistoria` ativa do associado/cotação (via `contrato_id` ou `cotacao_id` do contexto).
    2. Arquivar `video_360_url` atual (renomear tipo do registro antigo em `vistoria_fotos` para `video_360_historico_{ts}` se existir) e inserir o novo em `vistoria_fotos` com `tipo='video_360'`.
    3. `UPDATE vistorias SET video_360_url = publicUrl`.
    4. Marcar `documentos_solicitados` como `enviado` (sem criar linha em `documentos`, OU criar com `tipo='video_360'` apenas para auditoria — mantenho o registro para preservar histórico de pedidos).
- UI de preview: usar `<video controls>` em vez de `<img>` para itens já enviados de vídeo.

### 5. Memória
Atualizar `mem://logic/operations/autovistoria-2-fotos-video-360` (já existente em Core) com uma nota curta: "Reenvio de vídeo 360° é solicitável via Solicitar Reenvio › categoria 'Vídeo da Autovistoria'; pipeline público regrava `vistorias.video_360_url` e arquiva o vídeo anterior."

## Fora do escopo (registrado, não implementado agora)
A lista atual de 9 fotos em `Autovistoria — Roubo e Furto` no modal diverge do canônico (2 fotos + vídeo). Não vou tocar nessa lista neste pedido — peça à parte se quiser alinhar.

## Riscos / verificação
- Enum `tipo_documento` é usado em `documentos.tipo` — adicionar valor é aditivo (sem quebra).
- O bucket `cotacoes-docs` já aceita upload anônimo; vídeos grandes (>20MB típicos de 360°) seguem o mesmo limite. Sem mudança de policy.
- Conferir realtime no `AcompanhamentoProposta` (já escuta `documentos_solicitados`) — funciona sem mudança.

## Arquivos a alterar
- `supabase/migrations/{ts}_add_video_360_tipo_documento.sql` (novo)
- `src/components/cadastro/SolicitarDocumentosDialog.tsx`
- `src/hooks/useDocumentosSolicitados.ts`
- `src/components/cotacao-publica/DocumentosPendentesPublico.tsx`
- `mem://logic/operations/autovistoria-2-fotos-video-360.md`
