## Diagnóstico

**Caso real (screenshots):** Moto G / Android low-end, link público do prestador (`app.praticcar.org/prestador/<token>`), página `PrestadorInstalacao.tsx`, mensagem do Android Chrome: *"Devido à insuficiência de memória, não foi possível concluir a operação anterior"*. A aba foi descartada pelo Chrome (memory pressure → `document.wasDiscarded`), o estado em memória se perdeu e o checklist voltou para 1/31 / 0/30.

**Por que o link do prestador morre nesses dispositivos (≠ instalador interno):**

| Proteção | Instalador interno (`ExecutarVistoriaCompleta`) | Vistoria pública do cliente (`VistoriaPublica`) | **Prestador (`PrestadorInstalacao`) — hoje** |
|---|---|---|---|
| `useDeviceCapability` (perfil low/mid/high + log) | ✅ | ✅ (via AutovistoriaCotacao) | ❌ |
| Toast de retomada após OOM (`wasDiscarded`) | ✅ | ✅ | ❌ |
| `LowMemoryBanner` (libera previews ao apertar) | ✅ | — | ❌ |
| Fila IndexedDB (Dexie) p/ foto/vídeo | `useUploadVistoriaOffline` | `useUploadVistoriaPublicaOffline` + `useSyncQueuePublica` | ❌ (upload direto pro Storage, estado só em RAM) |
| Persistência local da captura (sobrevive a discard) | ✅ Dexie | ✅ Dexie | ❌ Só estado React + JSONB no servidor |
| Compressão adaptativa (`compressImage` com perfil low) | ✅ sem override | ✅ sem override | ✅ (já usa) |
| Persistência incremental no servidor | rascunho com `salvarRascunho` | enqueue offline | autoSave de **todo** o blob `fotos_vistoria` JSONB a cada upload |

**O que está realmente errado no Prestador:**
1. Cada foto vai direto pro Storage e o `fotosMap` é mantido em memória **e** persistido em JSONB inteiro na coluna `instalacao_prestador_links.fotos_vistoria` a cada mudança (autoSave 1,5 s). Quando o Chrome descarta a aba, a foto já está no Storage, mas o React perde o estado e ao reabrir só restaura o que veio da query — e o `useEffect` de restauração tem guard `restoredRef.current` que pode rodar antes do refetch e travar a hidratação.
2. Não há `useDeviceCapability` nem aviso/recuperação após OOM — usuário só vê "memória insuficiente" e abandona.
3. `VistoriaFotoSequencial` é um componente dark (slate-800, text-white), mas a página envolve em `bg-white` com `Card` claro → leitura ruim (screenshot #2) e contraste quebrado entre cards.
4. Geolocalização `watchPosition` com `enableHighAccuracy: true` rodando continuamente também pesa em low-end (descartável após o checklist começar).

## Plano

### Passo 1 — Memória e persistência (prioridade alta)

Adotar o mesmo padrão da vistoria pública do cliente, sem mudar contratos da edge function `concluir-instalacao-prestador`.

1. **Criar `useUploadPrestadorOffline(token)`** espelhando `useUploadVistoriaPublicaOffline`:
   - `enfileirarFoto(slot, file)` grava em IndexedDB (Dexie, origem `'publico'`, `token` = token do link).
   - Reusa o `useSyncQueuePublica` existente — só precisa garantir que ele aceite o bucket alvo. Se hoje só fala com `vistoria-fotos`, adicionar suporte ao bucket `prestador-fotos` (parâmetro de destino na enfileirarMidia ou um seletor por `origem+token`).
   - Retorna `previewsFotos` (Object URLs gerenciados, sem vazamento) + `pendentes`.
2. **Trocar o handler `handleFotoCapture`** para chamar `enfileirarFoto` em vez de fazer upload síncrono. A foto fica visível imediatamente (preview do blob local) e o uploader em background sobe pro Storage e atualiza `fotos_vistoria` na linha do link.
3. **Auto-save mais leve:** ao invés de regravar o JSONB inteiro de `fotos_vistoria` a cada mudança, só persistir o **slot afetado** (merge no servidor via RPC simples, ou via patch parcial usando o JSONB jsonb_set). Manter `checklist_data` como está (é pequeno).
4. **Adicionar `useDeviceCapability` + toast de retomada após `wasDiscarded`** (mesmo bloco que `ExecutarVistoriaCompleta` linhas 112-126).
5. **Adicionar `<LowMemoryBanner />`** no topo da página em execução, com handler que libera os Object URLs cacheados.
6. **Desligar `watchPosition` quando entrar em `em_execucao`** — manter só `getCurrentPosition` em intervalos maiores (60 s) ou só na transição de status; `enableHighAccuracy: true` contínuo é caro no Moto G.
7. **Hidratação robusta:** remover o guard `restoredRef.current` antes do refetch — usar `useEffect` que reage a `link?.id` + `link?.fotos_vistoria` e mescla com os pendentes do Dexie (Dexie ganha quando há blob local mais novo).
8. **Logar capacidade** no console igual ao instalador interno (deviceMemory, cores, lowEnd, heap, wasDiscarded) para diagnóstico futuro nos logs do navegador que o usuário compartilha.

### Passo 2 — Layout no padrão do instalador interno

Manter **todo** o ciclo de vida (aguardando → aceito → em_rota → em_execucao → conclusão), a edge function, os campos do link e o IMEI obrigatório. Só refazer o chrome visual da página para casar com `ExecutarVistoriaCompleta`:

1. **Tema escuro** no shell da página (`bg-slate-950` / texto claro) — `VistoriaFotoSequencial` foi desenhado para fundo escuro; isso elimina o contraste quebrado da screenshot #2.
2. **Reorganizar a seção `em_execucao`** no mesmo ritmo do interno:
   - Cabeçalho compacto com placa, modelo, IMEI buscado, status do rastreador.
   - Bloco "Conferência rápida do veículo" (placa/chassi/modelo/cor) igual `ExecutarVistoriaCompleta`.
   - Checklist com `ChecklistItem` (já é igual).
   - **Fotos** dentro de um card escuro `bg-slate-900` com o `VistoriaFotoSequencial` (já é o mesmo componente do interno — só estava com fundo errado).
   - Assinatura + IMEI agrupados num único card "Finalização".
3. **Barra fixa inferior** com o botão *Finalizar Instalação* + chips do que falta — mesmo padrão do interno (já existe, só ajustar cores p/ tema escuro).
4. **Sem mudanças** em: cards das etapas pré-execução (aguardando/aceito/em rota), dialogs de recusa e confirmação, geolocalização, validação de token, `concluir-instalacao-prestador`.

### Passo 3 — Validação

- Abrir o link num dispositivo "low-end emulado" (DevTools → Performance → CPU 4× slowdown + Memory profile) e verificar:
  - Console mostra `[Prestador] Capacidade do dispositivo: ... lowEnd=true profile=low`.
  - 31 fotos consecutivas com peak de heap < 250 MB.
  - Forçar `document.wasDiscarded` (DevTools → Application → Frames → Discard) e reabrir: fotos previamente capturadas reaparecem do Dexie + toast "Continuamos de onde você parou".
- Testar concluir instalação com fila parcialmente pendente (offline → online): edge function recebe `fotos_vistoria` completo.
- Conferir log da edge `concluir-instalacao-prestador` após a primeira instalação real.

### Não-objetivos (não vamos mexer)

- Edge function `concluir-instalacao-prestador` — payload de entrada e fluxo de IMEI/Softruck/Rede ficam intactos.
- Tabela `instalacao_prestador_links` — schema atual mantido.
- WhatsApp / template de notificação do link.
- Fluxo do instalador interno (já está saudável).

### Detalhes técnicos

- Novo arquivo: `src/hooks/useUploadPrestadorOffline.ts` (≈130 linhas, espelho do `useUploadVistoriaPublicaOffline`).
- Ajuste em `src/hooks/useSyncQueuePublica.ts`: aceitar `origem='publico'` com bucket alvo derivado do registro (foto do prestador → `prestador-fotos`; vistoria pública do cliente → `vistoria-fotos`).
- `src/pages/public/PrestadorInstalacao.tsx`: reescrita do shell visual + troca do handler de fotos + integração `useDeviceCapability` / `LowMemoryBanner`. Mesma estrutura de estados e mesmas chamadas a `publicSupabase` e `functions.invoke('concluir-instalacao-prestador')`.
- Memória nova (`mem://logic/operations/prestador-link-memoria-e-layout`) registrando: paridade com fluxo interno, fila Dexie, perfil adaptativo, tema escuro obrigatório para `VistoriaFotoSequencial`.
