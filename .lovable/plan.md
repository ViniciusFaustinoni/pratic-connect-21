

## Corrigir 2 bugs do app do técnico: travamento por memória nas fotos/vídeos e falso "Sem internet"

### Bug 1 — "Insuficiência de memória, não foi possível concluir a operação anterior"

**Causa raiz**

A tela de execução do técnico (`src/pages/instalador/ExecutarVistoriaCompleta.tsx`, usada pelo Mapa Mobile) recebe o `File` cru da câmera (5–12 MB em celulares modernos) e:

1. Em `handleUploadFoto` envia direto para `uploadFoto.mutateAsync` ou enfileira o blob cru no IndexedDB via `offlineQueue.enfileirarFoto`.
2. `VistoriaFotoSequencial` cria múltiplos `<img src=URL.createObjectURL(...)>` e thumbnails que mantêm o bitmap decodificado em RAM (4 bytes/pixel → uma foto de 12 MP = ~48 MB de heap).
3. Em série, com 31 fotos + vídeo 360°, o WebView Android estoura — daí o aviso nativo do Chrome **"Devido à insuficiência de memória, não foi possível concluir a operação anterior"** (a aba foi reciclada).

A versão do **associado** (`src/components/cotacao-publica/AutovistoriaCotacao.tsx`) já resolveu esse problema usando `compressImage` (perfil adaptativo `low/mid/high` baseado em `navigator.deviceMemory`) + `revokePreview` + telemetria de `wasDiscarded`. **A mesma infra (`src/lib/imageCompressor.ts`, `useDeviceCapability`) já existe — só não está sendo aplicada no caminho do técnico.**

**Correção**

Aplicar o mesmo padrão do associado em todos os pontos de upload de foto/vídeo do app do técnico, sem mudar UI nem regras de negócio:

| Arquivo | Mudança |
|---|---|
| `src/pages/instalador/ExecutarVistoriaCompleta.tsx` | Em `handleUploadFoto`: antes de enviar/enfileirar, se `file.size > 250KB` rodar `await compressImage(file)`. Liberar `file` original. Mesmo para `handleUploadVideo` no fluxo de queue (apenas valida tamanho — vídeo não comprimimos no client, mas garantimos `revokeObjectURL` agressivo). |
| `src/pages/instalador/InstaladorChecklist.tsx` | Mesma compressão em `handleFotoCapture` e `handleAddFotoChecklist` (tela de instalação clássica). |
| `src/components/vistorias/VistoriaFotoSequencial.tsx` | Trocar `<img src={url}>` das thumbnails por uma versão com `loading="lazy"` + `decoding="async"`; só montar a foto principal grande quando ativa (já é, mas garantir cleanup ao trocar via `key`). Não criar Object URLs locais — sempre usa URL remota retornada pelo upload. |
| `src/components/instalador/VideoCapture.tsx` | Já revoga `previewUrl` no `confirmed` — adicionar limite de tamanho (alertar se >100 MB) e revogar mais cedo (logo após `onCapture` retornar, não esperar `confirmed`). |
| `src/lib/offline/db.ts` (`enfileirarMidia`) | Antes de gravar foto no IndexedDB, comprimir se for `tipo='foto'` — evita estourar quota de storage do Dexie em low-end. |
| `src/pages/instalador/ExecutarVistoriaCompleta.tsx` (topo) | Adicionar `useEffect` de telemetria igual ao `AutovistoriaCotacao` (`deviceMemory`, `wasDiscarded`) e toast "Continuamos de onde você parou" quando voltar de OOM. |

Sem nova UI, sem mudança no banco, sem mudança nas edge functions. O `compressImage` já reduz uma foto de 12 MB para ~400-600 KB com perfil `mid` e ~250 KB com `low`.

**Critérios de aceitação Bug 1**

1. Caso real do anexo (31 fotos + vídeo 360° em Android com 4 GB RAM) — concluir sem o aviso "insuficiência de memória".
2. Console mostra `[compressImage] Perfil mid-end ativo: maxWidth=1280…` e tamanho final por foto < 800 KB.
3. Heap da aba (DevTools → Performance Memory) não cresce monotonicamente entre fotos — sobe e cai conforme `revokePreview`.
4. Em modo avião, a fila offline aceita as 31 fotos sem encher a quota do IndexedDB (< 25 MB total).

---

### Bug 2 — Banner "Sem internet — trabalhando offline" aparecendo com 5G/LTE ativo

**Causa raiz**

`src/hooks/useOnlineStatus.ts` decide se está online fazendo ping a `${supabaseUrl}/auth/v1/health` com headers `apikey` e `Authorization`. Esses headers **disparam preflight CORS (OPTIONS)**. Em algumas redes móveis e em WebViews Android (Chrome Custom Tab usado pelo PWA instalado), o OPTIONS para `/auth/v1/health` pode retornar sem `Access-Control-Allow-Headers: apikey, authorization` adequado em momentos de instabilidade, fazendo o `fetch` rejeitar com `TypeError: Failed to fetch` mesmo com rede 5G perfeita. Após 2 falhas consecutivas (~60s), o banner mostra "Sem internet". Em seguida o `useSyncQueue` checa `navigator.onLine` (que é `true`) e tenta sincronizar — mas o estado React continua `false` até o próximo ping.

Telemetria do anexo confirma: o usuário tem 5G ativo (ícone na barra de status), o token de sessão está válido (consegue carregar dados da vistoria) — mas o ping de health está falhando.

**Correção**

Trocar o ping para uma chamada **CORS-safe** que não exija preflight:

1. Usar `GET` simples para um asset estático do próprio domínio do app: `/favicon.ico?cb=${Date.now()}` (mesmo origin → sem CORS, sempre 200 quando há rede). Isso é o padrão usado por libs como `is-online`/`offline.js`.
2. Manter timeout de 10s e a lógica de "2 falhas consecutivas" para evitar flicker.
3. Como fallback, se o navegador disparar evento `online`, resetar `failuresInARow = 0` e marcar online imediatamente sem esperar próximo ping.
4. Adicionar log detalhado (`console.warn('[useOnlineStatus] ping falhou:', err.name, err.message)`) para diagnosticar futuros casos.

Sem mudança no `useSyncQueue`, no banner ou em qualquer outra dependência — ambos consomem `useOnlineStatus()` puro.

**Arquivo**

- `src/hooks/useOnlineStatus.ts` — substituir o `fetch` para Supabase health pelo ping de favicon do mesmo origem.

**Critérios de aceitação Bug 2**

1. No anexo (5G ativo, app conectado), o banner "Sem internet — trabalhando offline" não aparece.
2. Quando o técnico realmente fica offline (modo avião), o banner aparece em < 30 s e some em < 30 s ao reconectar.
3. Sincronização de fotos pendentes (`useSyncQueue`) dispara automaticamente quando volta online — comportamento atual é preservado.
4. Console mostra `[useOnlineStatus] ping ok` em redes lentas (LTE em movimento) sem oscilar para offline.

---

### Fora de escopo

- Mudar a fila de sync, RLS, edge functions ou tabelas.
- Refatorar a tela `InstaladorChecklist.tsx` para o fluxo novo do mapa (já há plano separado de unificação).
- Suportar HEIC do iPhone na compressão (segue como está — `accept="image/*"` + canvas converte para JPEG).
- Compressão de vídeo no client (custo de CPU alto demais para low-end; só validamos tamanho).

