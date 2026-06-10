---
name: Vistoria interna anti-limbo de fotos e vídeo
description: Causa raiz e defesas do caso 10/06/26 — UI do executor mostrava 30/30 + vídeo OK mas servidor estava em 0/31; raiz combinava limbo visual no VistoriaFotoSequencial com race na criação de vistoria pelo hook useVistoriaCompletaPorServico
type: feature
---

## Caso de origem
10/06/26, operador KAIKE (+55 21 97012-7002) executando vistoria interna a
partir de Monitoramento › Serviços de Campo. Print mostra simultaneamente:
- `Progresso de mídias` (canônico, do servidor): `0/31 fotos · ✗ vídeo`
- `VistoriaFotoSequencial` (estado local): "Todas as fotos foram enviadas!
  30/30 obrigatórias" + toast "Vídeo 360° enviado com sucesso!"
Ao sair e voltar, "some todas as fotos".

## Causa A — limbo visual no VistoriaFotoSequencial
O componente mantinha um `Set<string> uploadedLocally` populado no `useEffect`
de transição `uploadingFoto` truthy → null SEM checar se a foto realmente
apareceu em `fotosEnviadas`. Qualquer término de upload (inclusive falha com
`toast.error('Erro ao enviar foto')`) marcava como enviada localmente,
inflava a barra "30/30 obrigatórias" e mostrava o card verde. O refresh
limpava o set local e revelava o vazio do servidor.

**Correção (canônica, sem exceção):** contagem deriva 100% de `fotosEnviadas`
(servidor + previews da fila offline). `uploadedLocally` removido. Auto-avanço
só pula para a próxima foto quando a anterior aparece em `fotosEnviadas`.

## Causa B — race de criação de vistoria
`useVistoriaCompletaPorServico` (em `src/hooks/useVistorias.ts`) criava a
vistoria diretamente do client em 5 passos sem lock. Duas abas/refetches
simultâneos podiam criar vistorias paralelas; o último UPDATE em
`servicos.vistoria_origem_id` ganhava, e fotos uploadadas em vistorias
anteriores ficavam órfãs. UPDATE silencioso por RLS (`console.error` apenas)
agravava o cenário.

**Correção:** toda materialização passa pela RPC
`fn_obter_ou_criar_vistoria_servico(p_servico_id uuid)` (`SECURITY DEFINER`,
`pg_advisory_xact_lock(hashtextextended(servico_id::text, 0))`). Ordem de
resolução preservada: `vistoria_origem_id` → `instalacao_origem_id` →
`cotacao_id` → dedupe `em_analise` 24h → INSERT. Sempre amarra de volta
`servicos.vistoria_origem_id` no mesmo statement.

## Defesa permanente — BadgeVistoriaLimbo
Componente em `src/components/servicos-campo/BadgeVistoriaLimbo.tsx`
renderizado no header do `ServicoDetailModal` quando o serviço é
`instalacao/vistoria_entrada/revistoria` e detecta divergência:
- progresso UI presente (`servicos.etapa_atual > 1` OU `checklist_data`
  não-vazio) E
- (`vistoria_origem_id IS NULL` OU vistoria com 0 fotos + sem `video_360_url`)

Ação "Reconciliar mídias" chama a RPC + invalida queries — sem isso, o
coordenador só descobre por reclamação do operador.

## Arquivos canônicos
- `src/components/vistorias/VistoriaFotoSequencial.tsx` (UI nunca mente)
- `supabase/migrations/.../fn_obter_ou_criar_vistoria_servico.sql` (RPC com lock)
- `src/hooks/useVistorias.ts > useVistoriaCompletaPorServico` (consome a RPC)
- `src/components/servicos-campo/BadgeVistoriaLimbo.tsx` (detecção + ação)
- `src/components/servicos-campo/ServicoDetailModal.tsx` (renderiza o badge)

## Não regredir
- Nunca reintroduzir contagem de fotos baseada em estado local efêmero
  (Set/ref) sem confirmação do servidor — a UI tem que doer quando algo
  falha, não mostrar verde para deixar passar.
- Nunca recriar a materialização da vistoria fora da RPC.
- O badge cobre os 3 tipos canônicos da primeira visita
  (`instalacao | vistoria_entrada | revistoria`) — manter sincronizado com
  `mem://logic/operations/vistoria-entrada-equivale-instalacao`.
