

## Corrigir falhas de envio de vídeo 360° (Auto-vistoria pública e Instalador)

### Diagnóstico (com evidências do banco)

Verifiquei os buckets de storage e os uploads recentes:

| Bucket | Usado por | Limite por arquivo |
|---|---|---|
| `cotacoes-vistoria` | Auto-vistoria pública (cotação) | **52 MB (HARD LIMIT)** |
| `vistoria-videos` | Vistoria do instalador / vistoria completa | sem limite |
| `vistorias` | Retirada do instalador | sem limite |
| `documentos` | Auto-vistoria de contrato (associado logado) | sem limite |

Uploads bem-sucedidos recentes (últimas 24h) já estão no limite: **44 MB, 46 MB, 47 MB, 38 MB**. Vários iPhones gravando 1-2 minutos em alta qualidade ultrapassam 52 MB e o Storage rejeita com erro genérico — daí o toast `"Erro ao enviar vídeo. Tente novamente."`.

Outros problemas identificados nos handlers atuais:
1. **Mensagem de erro inútil** — todos os 4 handlers de vídeo (`AutovistoriaCotacao`, `Autovistoria`, `CotacaoPublicaCompleta`, `ExecutarRetirada`) capturam o erro e mostram `"Erro ao enviar vídeo"` sem distinguir a causa (limite de tamanho, rede caiu, sessão expirou, mime rejeitado).
2. **Sem retry automático** — uma falha de rede temporária derruba o upload inteiro e o associado tem que regravar o vídeo.
3. **Sem aviso preventivo de tamanho** — só existe um `toast.warning` para >100 MB no `VideoCapture`, mas o limite real do bucket público é metade disso.
4. **Sem indicação de progresso real** — o usuário vê só `Enviando vídeo...` indefinidamente; em conexões lentas (3G/4G fraco) parece travado.
5. **Bucket `cotacoes-vistoria` rejeita arquivos `.mov` do iPhone** se o mimetype real divergir da lista permitida (`video/quicktime` está na lista, mas alguns Safaris reportam mimetype vazio).

### O que vai mudar

**1. Subir o limite do bucket `cotacoes-vistoria` para 200 MB**

Migration alterando `storage.buckets.file_size_limit` de `52428800` para `209715200` (200 MB). O bucket `vistoria-videos` continua sem limite — manter assim. Uma vistoria 360° de 2 minutos gravada em iPhone moderno cabe folgadamente em 150 MB.

**2. Compressão/transcodificação opcional no cliente para vídeos grandes**

No `VideoCapture.tsx`, ao receber arquivo via galeria (`handleFileUpload`):
- Se `file.size > 80 MB`, mostrar toast informativo: `"Vídeo grande detectado — preparando para envio…"` e tentar reduzir bitrate via `MediaRecorder` re-encode em `video/webm;codecs=vp9` a 1 Mbps (chunked, 5s por chunk) **se** o navegador suportar.
- Se a transcodificação falhar ou for muito lenta (>15s), enviar o arquivo original mesmo assim — o limite de 200 MB já cobre a maioria dos casos.
- Para gravação direta com `MediaRecorder`, adicionar `videoBitsPerSecond: 1_500_000` no construtor (linha 145) para limitar gravações longas a ~12 MB/min.

**3. Retry com backoff e mensagens específicas**

Criar um helper `uploadVideoWithRetry(supabaseClient, bucket, path, file)` em `src/lib/videoUpload.ts` que:
- Tenta upload até 3 vezes com backoff exponencial (1s, 3s, 8s).
- Identifica erros específicos pelo `error.message`/`statusCode` do Supabase Storage:
  - `Payload too large` / `413` → `"Vídeo muito grande. Grave um vídeo mais curto (até 1 minuto)."`
  - `JWT expired` / `401` → `"Sua sessão expirou. Recarregue a página e tente novamente."`
  - `Network request failed` / `Failed to fetch` → tentar de novo silenciosamente; se esgotar, `"Conexão instável. Verifique sua internet e tente novamente."`
  - `mime type ... not allowed` → `"Formato de vídeo não suportado. Grave novamente usando o botão da câmera."`
- Loga cada tentativa no console com `[videoUpload]` para facilitar debug.

Adotar o helper nos 4 pontos: `useUploadFotoCotacaoVistoria` (linha 65), `useContratoLink.useUploadFotoAutovistoria` (linha 439), `useVistoriaCompleta.useUploadVideo360` (linha 358), `ExecutarRetirada.handleUploadVideo` (linha 367).

**4. Indicador de progresso real**

`@supabase/storage-js` não expõe `onUploadProgress` nativo, mas dá pra estimar via `XMLHttpRequest` direto contra o endpoint `/storage/v1/object/<bucket>/<path>` com `Authorization` header. Implementar isso no helper:
- Atualizar uma callback `onProgress(percent: number)` durante o upload.
- No `VideoCapture.tsx`, exibir barra de progresso dentro do bloco `uploading` (linha 308-312) em vez de só o spinner: `Enviando vídeo... 47%`.
- Cada handler passa a callback que atualiza um state local `uploadProgress`.

**5. Aviso preventivo no fim da gravação**

No `MediaRecorder.onstop` do `VideoCapture` (linha 154), depois de criar o blob, se `blob.size > 80 * 1024 * 1024`, mostrar toast: `"Vídeo gerado com X MB — pode demorar para enviar em conexão lenta."` (informativo, não bloqueia).

### O que NÃO muda

- Fluxo geral da auto-vistoria, ordem dos passos e UX de gravação seguem iguais.
- Buckets continuam como estão (apenas o limite do `cotacoes-vistoria` muda).
- Validação de chassi/odômetro via OCR não é afetada.
- Política de RLS dos buckets continua intacta.

### Riscos

- Subir limite para 200 MB aumenta custo de armazenamento marginalmente. Mitigado pelo bitrate cap no MediaRecorder (gravações novas ficam em ~12 MB/min).
- Re-encode no cliente consome CPU em celulares antigos. Mitigado pelo timeout de 15s — se demorar, enviamos o original.
- O `XMLHttpRequest` direto contra `/storage/v1/object` exige replicar o header de auth do client. Já temos isso no `supabase.auth.getSession()` para o cliente autenticado; para o público (`publicSupabase`), usamos a `anon key` direto.

### Arquivos editados

- **Migration nova**: `ALTER` no `storage.buckets` para subir o limite de `cotacoes-vistoria` para 200 MB.
- `src/lib/videoUpload.ts` (novo) — helper com retry, progress e mensagens de erro específicas.
- `src/components/instalador/VideoCapture.tsx` — `videoBitsPerSecond`, aviso de tamanho pós-gravação, barra de progresso.
- `src/hooks/useCotacaoVistoria.ts` — usar helper no upload da auto-vistoria pública.
- `src/hooks/useContratoLink.ts` — usar helper no upload da auto-vistoria do associado logado.
- `src/hooks/useVistoriaCompleta.ts` — usar helper em `useUploadVideo360`.
- `src/pages/instalador/ExecutarRetirada.tsx` — usar helper em `handleUploadVideo`.
- `src/pages/public/CotacaoPublicaCompleta.tsx` e `src/components/associado/Autovistoria.tsx` — passar callback `onProgress` para o `VideoCapture`.

