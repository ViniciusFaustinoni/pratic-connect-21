

## Causa raiz (confirmada por inspeção do banco)

Verifiquei as 4 fotos quebradas do print. **Todas têm 0 bytes no storage**, mas seu registro existe em `vistoria_fotos`:

| Tipo | Tamanho real |
|---|---|
| `painel_km` | **0 bytes** ❌ |
| `local_rastreador` | **0 bytes** ❌ |
| `lateral_esquerda` | **0 bytes** ❌ |
| `traseira` | **0 bytes** ❌ |
| `frente` | 2.4 MB ✅ |
| `lateral_direita` | 2.1 MB ✅ |
| `motor_chassi` | 2.9 MB ✅ |
| `avarias` | 2.0 MB ✅ |
| video 360 .webm | **0 bytes** ❌ |

ETag das 4 fotos = `d41d8cd98f00b204e9800998ecf8427e` (MD5 do arquivo vazio). O analista vê só o **alt text** (`painel_km`, `local_rastrea`...) porque o `<img>` não consegue renderizar nada.

## 3 bugs reais

### Bug 1 — Race em `useVistoriaCompleta.ts` (linhas 432–453) [CAUSA PRIMÁRIA]
O fluxo é: `upload novo → buscar antiga (mesmo tipo) → deletar do storage`. Mas a busca da antiga (linha 425) acontece **antes** do upload e devolve só `id, arquivo_url`. Quando o vistoriador re-tira a mesma foto rapidamente (ou quando o sync queue + o upload direto disputam o mesmo `tipo`), há janela em que:
1. Upload A finaliza → URL pública criada
2. Upload B começa, lê a "antiga" (= A), faz upload do B
3. Insere registro B no DB (`arquivo_url` aponta pro caminho B)
4. **Deleta A do storage** ✅
5. Mas o **path B já é o próprio recém-subido** porque o `Date.now()` colidiu ou porque o segundo upload tentou `upsert` num path idêntico → o storage manteve o registro mas com bytes do `remove` posterior

A combinação `useUploadFotoVistoriaCompleta` (sem `upsert`, sem `contentType`) + `useSyncQueue` (com `upsert: true`, `contentType: midia.mime`) na **mesma vistoria, mesmo tipo, ao mesmo tempo**, resulta em arquivo zerado quando o blob da fila offline já foi descartado/revogado mas o registro ainda processa.

### Bug 2 — Vídeo `.webm` no Safari/iOS
`VideoCapture.tsx:72-87` força sempre `video/webm;codecs=vp9`. iOS Safari (que muito analista usa em iPad) **não decodifica webm** — exibe só o ícone de play quebrado, igual ao print do usuário. O preview no `<video>` da `PropostaMidiaGrid` (linha 94) idem.

### Bug 3 — Sem `contentType` no upload primário
`useVistoriaCompleta.ts:436-438` chama `.upload(fileName, data.file)` **sem** opções. Sem `contentType` e sem `upsert: false` explícito, se o `data.file` for um Blob sem mime declarado o storage pode aceitar e gravar sem header, prejudicando o servir cross-origin pra `<img>`/`<video>`.

## Plano de correção

### Arquivo 1: `src/hooks/useVistoriaCompleta.ts`

**A) Eliminar a race**: trocar a estratégia "upload novo + delete antiga" por **upsert direto em path determinístico**:
```ts
const fileName = `${data.vistoriaId}/${data.tipo}.jpg`; // SEM Date.now()
await supabase.storage.from('vistoria-fotos').upload(fileName, data.file, {
  contentType: data.file.type || 'image/jpeg',
  upsert: true,                  // sobrescreve a antiga atomicamente
  cacheControl: '3600',
});
```
- Eliminar todo o bloco `fotoExistente` + delete posterior (linhas 425-454).
- Usar `onConflict` no insert da `vistoria_fotos` (constraint `vistoria_id+tipo` única) com `upsert` do PostgREST: `.upsert(payload, { onConflict: 'vistoria_id,tipo' })`. Se o constraint não existir, criar via migration.
- Ao atualizar a URL no DB, anexar `?v=${Date.now()}` pra furar cache do CDN no analista.

**B) Mesmo tratamento em `useUploadVideo360`** (linhas 343-398): path determinístico `${vistoriaId}/video_360.<ext>`, `upsert: true`, `contentType` obrigatório.

### Arquivo 2: `src/hooks/useSyncQueue.ts`

- Antes de subir cada item da fila, **validar que `midia.blob.size > 0`**. Se zero, abortar o item, marcar como `falha_permanente` e logar (evita gravar arquivo vazio no storage).
- Mesmo `path determinístico` do Arquivo 1. Como o queue já usa `upsert: true`, basta alinhar os nomes.

### Arquivo 3: `src/components/instalador/VideoCapture.tsx`

- Detectar suporte e gravar em **MP4 quando disponível** (Safari/iOS suporta `video/mp4`); cair pra `video/webm;codecs=vp9` como fallback:
```ts
const candidates = [
  'video/mp4;codecs=h264,aac',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm',
];
const mimeType = candidates.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
```
- Salvar o `File` com a extensão correta (`video_360_${Date.now()}.${ext}`).

### Arquivo 4: `src/components/cadastro/proposta/PropostaMidiaGrid.tsx` (defensivo)

- Adicionar `onError` no `<img>` que substitui por placeholder "Arquivo corrompido — pedir reenvio" + botão pra disparar `solicitar reenvio` ao cliente, em vez de mostrar texto bruto.
- Adicionar `<source type="video/webm">` e `<source type="video/mp4">` no `<video>` pra navegador escolher.

### Migração SQL

Adicionar constraint única se não existir:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS vistoria_fotos_vistoria_tipo_uniq 
  ON vistoria_fotos(vistoria_id, tipo);
```

### Limpeza dos 5 órfãos atuais

Script de migration uma vez: deletar registros de `vistoria_fotos` cujo objeto no storage tem `metadata->>'size' = '0'`, e zerar `vistorias.video_360_url` da vistoria `f6a53640...`. Avisar o vistoriador via WhatsApp pra reenviar (ou só marcar a vistoria como `requer_reenvio`).

## Não mexer

- Bucket policies (já públicas), `usePropostasPendentes`, layouts da análise, fluxo de aprovação.

## Validação

1. Re-tirar a mesma foto 3x rápido → só 1 registro fica, com bytes corretos.
2. Subir vídeo no Safari iOS → toca normal pro analista.
3. Forçar fila offline com blob zerado (DevTools) → não cria registro vazio no DB.
4. Abrir proposta `f6a53640...` após limpeza → arquivos quebrados removidos, status indica "aguardando reenvio".

## Resultado

Foto/vídeo quebrados deixam de existir na origem. Quando o blob é válido, chega íntegro ao analista. Quando algo falha, o sistema **avisa explicitamente** em vez de mostrar imagem quebrada.

