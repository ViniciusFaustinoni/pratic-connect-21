
## Plano: estender vistoria offline-first para vistoriadores comuns

### Diagnóstico
A infra offline (Dexie + `useSyncQueue` + banner + tela de sincronização) já está pronta e suporta `origem: 'instalador'`. Falta só plugar nos componentes de captura do fluxo do vistoriador comum, que hoje fazem upload direto pro Supabase Storage.

### Investigação necessária (na próxima rodada)
1. Localizar `ExecutarVistoriaCompleta.tsx` (vistoriador base + agendada — paridade pela memória `inspection-workflow-parity`).
2. Identificar como hoje as fotos/vídeo são capturados e enviados (provável `useUploadVistoria` ou similar chamando `supabase.storage.upload` direto).
3. Verificar se `InstaladorLayout` já tem `<SyncStatusBanner />` (foi adicionado na rodada anterior — confirmar) e se a rota `/instalador/sincronizacao` está ativa.

### Mudanças

**1. Refatorar captura de fotos do vistoriador**
- Trocar upload direto por `enfileirarMidia({ origem: 'instalador', tipo: 'foto', slot, blob })`.
- Mostrar preview a partir do blob local quando a URL do servidor ainda não existir (mesmo padrão do `VistoriaEventoMidias.tsx`).
- Botão "Refazer" remove da fila local antes de capturar de novo.

**2. Refatorar captura de vídeo**
- Idem para o slot `'360'` (ou nome usado no fluxo do vistoriador).

**3. Combinar fotos do servidor + previews locais**
- Helper `fotoUrl(i)` igual ao já feito para o regulador: prioriza URL do servidor, cai pro `URL.createObjectURL(blob)` da fila.

**4. Botão "Finalizar vistoria"**
- Permitir prosseguir mesmo com itens na fila (já implementado no banner global).
- Mensagem de aviso: "X mídias ainda serão enviadas em segundo plano".

**5. Confirmar fluxo no `useSyncQueue`**
- Já trata `origem === 'instalador'` via Storage direto + bucket `vistoria-fotos`/`vistoria-videos`. Validar que o path bate com o que o resto do app espera ler depois.

**6. Edge function / persistência final**
- Quando todas as mídias do `vistoria_id` chegarem no Storage, atualizar `vistorias` (ou tabela equivalente do vistoriador) com as URLs. Fazer isso via trigger no Storage **ou** via `enfileirarVistoria` no Dexie disparando uma chamada final ao endpoint de finalização quando a fila esvazia. Decidir após ver o código atual.

### Arquivos prováveis
- `src/components/instalador/ExecutarVistoriaCompleta.tsx` (ou pasta `vistoriador/`)
- `src/components/instalador/FotoCapture.tsx` e `VideoCapture.tsx` (já existem — usados pelo regulador)
- Hook de upload atual (a localizar — provável `useVistoriaUpload` ou similar)
- Possível ajuste em edge function de finalização para aceitar `client_id` por mídia

### Não vou mexer
- Schema Dexie (já suporta).
- `useSyncQueue` (já suporta `origem: 'instalador'`).
- Banner global e tela `/instalador/sincronizacao` (já criados).

### Resultado
Vistoriador comum (base + agendada) completa vistoria sem internet exatamente como o regulador faz hoje: fotos/vídeo persistidos no IndexedDB, sincronização automática quando voltar online, mesmo banner, mesma tela de pendências.
