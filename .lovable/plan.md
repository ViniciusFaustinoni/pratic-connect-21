
## O que aconteceu (hipótese principal)

O operador estava na vistoria interna do Monitoramento (rota `/instalador/instalacao/:id` aberta a partir de Serviços de Campo). O print mostra **dois contadores incoerentes na mesma tela**:

- topo (canônico, leitura do servidor): **`0/31 fotos · ✗ vídeo`** + lista "Faltam: Selfie…, Chave, Chassi, vídeo 360°…"
- corpo (`VistoriaFotoSequencial`, estado local): **"Todas as fotos foram enviadas! 30/30 obrigatórias"** + toast "Vídeo 360° enviado com sucesso!"

A divergência só é possível quando o componente filho marca como "enviada" sem que a foto realmente exista em `vistoria_fotos` para a `vistoria_id` que a tela carrega. Por isso, ao sair e voltar, "some todas as fotos": o estado local é descartado e a verdade do servidor (vazia) aparece.

Há **duas causas que se somam**:

### Causa A — limbo visual (UI mente para o operador)

`src/components/vistorias/VistoriaFotoSequencial.tsx` mantém um `Set<string> uploadedLocally` que é populado pelo `useEffect` na transição `uploadingFoto` truthy → null (linhas 50–73). Esse efeito **não distingue sucesso de falha** — qualquer término de upload (até com `toast.error('Erro ao enviar foto')`) marca a foto como enviada localmente, alimenta a barra "30/30 obrigatórias" e mostra o card verde "Todas as fotos foram enviadas!". O `Progresso de mídias` no pai usa `vistoriaCompleta.fotos` (canônico) e por isso permanece em `0/31`.

### Causa B — fotos vão para uma `vistoria_id` órfã (raiz no banco)

`useVistoriaCompletaPorServico` (em `src/hooks/useVistorias.ts:894`) resolve a vistoria nessa ordem: `servico.vistoria_origem_id` → `instalacao_origem_id` → `cotacao_id` → dedupe `em_analise` 24h → **cria nova vistoria** + tenta UPDATE em `servicos.vistoria_origem_id`. Cenários reais que produzem o sintoma:

1. **Race entre 2 abas/sessões abertas no mesmo serviço** (o operador disse "fiz 3 vezes"): cada execução do queryFn não vê `vistoria_origem_id` no servidor ainda → cria vistoria nova → as 30 fotos do "passo seguinte" caem na vistoria A, mas o refetch posterior trouxe vistoria B (a última gravada em `servicos.vistoria_origem_id`).
2. **UPDATE silencioso falhando por RLS** (`updateVistErr` é só `console.error`) → a cada navegação o hook acha vistoria B/C/D, fotos espalhadas, nenhuma "casa" com a vistoria exibida.
3. **Trigger `sync_vistoria_to_servicos` ou substituição por instalação canônica** (ver `mem://logic/operations/vistoria-entrada-equivale-instalacao` / `mem://logic/operations/servicos-um-canonico-por-origem`) reescreveu `vistoria_origem_id` no meio do trabalho — fotos da "vida anterior" ficam órfãs.

A combinação A + B é exatamente o relato: a UI confirma 30/30 + vídeo OK, mas a vistoria que a tela carrega na próxima visita não tem nada.

## O que esta investigação vai entregar

Sem mexer em placas existentes (você já as moveu), o trabalho abaixo é só de diagnóstico + correção de raiz, deixando o canônico imune a esse limbo.

### 1) Forense do caso real (read-only)

Localizar a vistoria do operador (telefone +55 21 97012-7002 e timestamp do print 10/06 09:34) e listar:
- Todas as `vistorias` criadas nas últimas 24h para esse `associado_id` / `veiculo_id` / `cotacao_id` / `servico_id`.
- Para cada uma: `vistoria_fotos.count`, `video_360_url`, `created_at`, `status`, `vistoriador_id`, `instalacao_id`.
- Em `servicos`: `vistoria_origem_id` atual + histórico via `logs_auditoria` (entidade='servico').
- Em `logs_auditoria` / `edge_function_logs` da janela 09:30–09:40: erros 23503 (FK), 42501 (RLS), `[Upload Foto]`, `[useVistoriaCompletaPorServico]`.
- Confirmar se há vistoria "fantasma" com 30 fotos + vídeo perdida e a vistoria visível com 0.

Se confirmado órfão, **migrar as fotos + `video_360_url` da vistoria órfã para a vistoria canônica do serviço** num script de migração pontual (saneamento), com auditoria.

### 2) Corrigir o limbo visual (Causa A — defesa imediata)

Em `src/components/vistorias/VistoriaFotoSequencial.tsx`:
- O `uploadedLocally` só pode ser populado quando a foto realmente aparece em `fotosEnviadas` (prop vinda do servidor). Hoje ele se adianta cegamente.
- Remover o `setUploadedLocally(...)` do `useEffect` de transição `uploadingFoto`. O contador deve **derivar 100% de `fotosEnviadas`** (que já recebe previews locais via `previewsFotos` no `ExecutarVistoriaCompleta`, e direto do servidor no `InstaladorChecklist`).
- Adicionar fallback visual: enquanto `uploadingFoto === fotoId` mostra "Enviando…"; sem upload em curso e sem registro no servidor, mostra "pendente" — sem mentir.

### 3) Tornar a materialização da vistoria à prova de race (Causa B — raiz canônica)

Em `useVistoriaCompletaPorServico` (`src/hooks/useVistorias.ts`):
- Trocar o INSERT por uma RPC `fn_obter_ou_criar_vistoria_servico(servico_id uuid)` em SQL `SECURITY DEFINER` que, dentro de transação, faz `SELECT ... FOR UPDATE` no serviço, resolve por `vistoria_origem_id`/`instalacao_origem_id`/`cotacao_id`, dedupa por (associado, veículo, cotação, 24h) e só cria se não houver — depois UPDATE do serviço. Isso elimina race entre abas/refetches.
- Propagar erro do UPDATE de `vistoria_origem_id` (hoje é `console.error` silencioso) — se falhar, toast e abortar (não retornar vistoria desvinculada).

### 4) Anti-limbo no Serviços de Campo (defesa permanente)

Reaproveitar o padrão já criado para Troca (`useTrocaLimbo`): hook `useVistoriaLimbo` que detecta serviços/vistorias onde a UI do executor declara progresso mas o servidor diverge (ex.: `servicos.checklist_data` salvo + `vistoria_fotos.count = 0` + sem `video_360_url`). Mostrar badge âmbar no card do serviço em **Monitoramento › Serviços de Campo › Serviços** com ação "Reconciliar mídias" (chama RPC do passo 3 + invalida queries). Sem botão, o coordenador depende da reclamação do operador para descobrir.

## Detalhes técnicos

- Arquivos tocados (correção):
  - `src/components/vistorias/VistoriaFotoSequencial.tsx` — remover `uploadedLocally`; contagem 100% derivada de `fotosEnviadas`.
  - `src/hooks/useVistorias.ts` — `useVistoriaCompletaPorServico` chama nova RPC; propaga erros de vinculação.
  - `supabase/migrations/<ts>_fn_obter_ou_criar_vistoria_servico.sql` — função `SECURITY DEFINER` com lock, dedup e auditoria.
  - `src/hooks/useVistoriaLimbo.ts` + chip/badge em `ServicoDetailModal.tsx` (ou no card de `ServicosCampoUnificado`).
- Arquivos de leitura (forense, sem alterar): `useVistoriaCompleta.ts` (upload), `vistorias_*` no schema, `logs_auditoria`, `edge_function_logs`.
- Sem mexer em: placas que você já reposicionou, fluxo público (`link público intocável`), `concluir-instalacao-*`.
- Memória nova a salvar após confirmar: `mem://logic/operations/vistoria-interna-anti-limbo-fotos-video`.

## Pré-aprovação necessária

Pra começar a forense preciso saber se posso rodar leituras (read_query) na base de produção pra puxar o caso real do operador, ou se você prefere me passar a `servico_id` / placa / matrícula do incidente. Sem isso, vou só nas correções A, 3 e 4 às cegas.
