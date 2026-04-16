
## Plano: vistoria offline-first para o técnico

### Objetivo
Permitir que o vistoriador execute a vistoria completa (fotos + vídeo + dados) sem internet. Tudo fica salvo no dispositivo e é enviado automaticamente quando a conexão voltar — sem perder nada e sem o técnico precisar refazer.

### Como vai funcionar (visão do usuário)
1. Técnico abre uma vistoria. App baixa tudo que precisa (dados do veículo, associado) enquanto ainda tem sinal.
2. Sem internet, ele bate fotos, grava vídeo, preenche checklist normalmente. Tudo é salvo localmente no celular.
3. Indicador no topo mostra "Modo Offline — X itens aguardando envio".
4. Quando a internet volta, a sincronização começa sozinha em segundo plano: cada foto/vídeo sobe, o status da vistoria avança, e o técnico vê "Sincronizado ✓".
5. Se algum upload falhar, ele tenta de novo automaticamente (com backoff). Técnico pode forçar "Tentar agora".

### Arquitetura técnica

**1. Armazenamento local — IndexedDB via Dexie.js**
- LocalStorage não serve (limite ~5MB, fotos/vídeos são MB cada).
- Dexie.js (~25KB gz) é o padrão para IndexedDB no React. Suporta blobs grandes (fotos/vídeo de 50-200MB sem problema, limite real do iOS Safari ~1GB, Android Chrome ilimitado com permissão).
- Schema local:
  - `vistorias_pendentes` — snapshot dos dados da vistoria (id, vistoria_id, payload JSON, status: `rascunho` | `pronta_para_envio` | `enviando` | `enviada` | `erro`).
  - `midias_pendentes` — `{ id, vistoria_id, tipo: 'foto' | 'video', slot, blob: Blob, mime, criado_em, tentativas, ultimo_erro }`.

**2. Camada de captura (substituir URL.createObjectURL por persist)**
- Hoje `CapturaFoto.tsx` e equivalentes de vídeo geram um `objectURL` em memória — perde-se ao recarregar a página.
- Mudar para: ao capturar, gravar o `Blob` em `midias_pendentes` e gerar `objectURL` a partir do blob lido do IndexedDB. Isso garante que recarregar não perde nada.

**3. Detecção de conectividade**
- Hook `useOnlineStatus` usando `navigator.onLine` + ping leve no Supabase a cada 30s (porque `navigator.onLine` mente em alguns Androids — diz "online" mesmo sem rota).
- Banner global no app do profissional: "Sem internet — trabalhando offline" (vermelho) / "Sincronizando 3 itens..." (azul) / "Tudo sincronizado" (verde, some em 3s).

**4. Fila de sincronização (`useSyncQueue`)**
- Worker em background (timer + listener `online`).
- Algoritmo:
  1. Listar `midias_pendentes` ordenadas por `criado_em`.
  2. Para cada uma: tentar upload no Storage Supabase.
  3. Se sucesso: atualizar `dados_vistoria` no banco com a URL, deletar da fila local.
  4. Se erro (rede, 5xx): incrementar `tentativas`, agendar retry com backoff exponencial (5s, 30s, 2min, 10min, 1h).
  5. Se erro permanente (4xx, validação): marcar `status: 'erro'` e mostrar para técnico resolver.
- Concorrência: 1 upload por vez (evita saturar 3G/4G fraco).
- Continua mesmo com aba em background (Service Worker `sync` event quando suportado, fallback `setInterval` quando aba visível).

**5. Service Worker para "última milha" + Background Sync**
- Já existe SW (PWA do profissional). Adicionar:
  - Cache de assets (já tem) com `registerType: 'autoUpdate'` para evitar bug Safari recente.
  - **Background Sync API** (Chrome Android): registra tag `'sync-vistorias'` quando há fila pendente; SW dispara upload quando OS detecta rede, mesmo com app fechado.
  - iOS Safari **não suporta** Background Sync — fallback: sync ao abrir o app + Periodic Sync onde disponível.

**6. Conflitos e idempotência**
- Cada mídia tem `client_id` UUID gerado offline. Edge function `salvar-vistoria-regulador` (e similares) precisa aceitar esse ID como chave de idempotência: se receber a mesma mídia 2x (retry duplicado), não duplica.
- Status da vistoria: usar transição condicional (`UPDATE ... WHERE status = 'em_andamento'`) para não regredir estado se servidor já recebeu.

### Telas afetadas (escopo inicial)
- **`ExecutarVistoriaEvento.tsx`** (regulador) — caso já mostrado nos arquivos.
- **`ExecutarVistoriaCompleta.tsx`** (vistoriador base + agendada — mesmo componente por memória `inspection-workflow-parity`).
- **`CapturaFoto.tsx`** — trocar in-memory por persist.
- Componente equivalente de vídeo (verificar se existe em `VistoriaEventoMidias.tsx`).
- **`OSFotoUpload.tsx`** (oficinas) — opcional na fase 1, recomendado fase 2.

### Limites e avisos para o usuário
- iOS Safari pode purgar IndexedDB após 7 dias sem abrir o app (ITP). Mostrar aviso "Sincronize antes de fechar por muitos dias".
- Vídeos grandes (>500MB) em conexão fraca: oferecer compressão client-side opcional (fase 2).
- Quota de storage do navegador: monitorar via `navigator.storage.estimate()` e avisar quando >80%.

### Entregáveis (o que vou implementar quando aprovar)
1. Instalar `dexie` e `dexie-react-hooks`.
2. `src/lib/offline/db.ts` — schema Dexie (`vistorias_pendentes`, `midias_pendentes`).
3. `src/hooks/useOnlineStatus.ts` — detecção robusta com ping.
4. `src/hooks/useSyncQueue.ts` — worker de upload com retry/backoff.
5. `src/components/profissional/SyncStatusBanner.tsx` — indicador global.
6. Refatorar `CapturaFoto.tsx` e o capturador de vídeo para gravar blob no Dexie.
7. Refatorar `ExecutarVistoriaEvento.tsx` / `ExecutarVistoriaCompleta.tsx` para ler/gravar mídia da fila local em vez de upload direto.
8. Service Worker: adicionar handler `sync` para `'sync-vistorias'`.
9. Edge functions de salvamento: aceitar `client_id` como idempotency key.
10. Tela `/profissional/sincronizacao` — lista de itens pendentes com botão "Tentar agora" e "Ver erro".

### Fora de escopo (fase 1)
- Cadastro/edição de outras entidades offline (associados, contratos) — só vistorias.
- Compressão automática de vídeo.
- Conflitos multi-dispositivo (assume 1 técnico = 1 dispositivo por vistoria).

### Resultado esperado
Técnico em área sem sinal completa a vistoria do início ao fim. Ao chegar em local com 4G/Wi-Fi, app sincroniza tudo automaticamente em segundo plano. Zero retrabalho, zero perda de mídia, zero "preciso voltar lá com sinal".
