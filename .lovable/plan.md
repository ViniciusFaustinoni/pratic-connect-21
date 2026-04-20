

## Adicionar botão de atribuição rápida nos cards do Mapa

### O que muda
Em cada card de serviço pendente no painel lateral do Mapa de Monitoramento, ao lado do botão de localizar (📍) e do botão de WhatsApp (✉️), adicionar um **botão "Atribuir" (ícone `UserPlus`)** que abre um popover com a lista de técnicos ativos. Clicar em um técnico atribui o serviço imediatamente — alternativa ao drag-and-drop atual.

### Onde
Arquivo único: `src/components/mapa/MapaVistoriasContent.tsx`, dentro do bloco de ações do card (linhas 657-678, coluna `flex flex-col gap-1 flex-shrink-0`).

### Comportamento
- **Visível somente quando** o card é "atribuível":
  - `atribuicaoManualAtiva` (flag global ligada) **e**
  - serviço ainda não realizado **e**
  - `!v.vistoriador_id` (não atribuído) **e**
  - `v.servico_id_unificado` existe.
  - Não exige coordenadas GPS (diferente do drag), atendendo justamente os cards "Sem coordenadas GPS" do print.
- Clique no botão → abre `Popover` com:
  - título "Atribuir a um técnico"
  - lista filtrável (input simples) de técnicos retornados por `useVistoriadoresAtivos()`
  - cada item mostra avatar/iniciais + nome + badge do tipo de alocação do dia (Rota / Base — se houver)
- Clique em um técnico → chama `atribuirServicoMutation.mutate({ servicoId: v.servico_id_unificado, profissionalId: tecnico.id, isBase: <derivado> })`
- Sucesso → fecha popover, toast "Serviço atribuído a {nome}", invalida queries (já feito pela mutation existente)
- Erro → toast com `error.message` (regra de pareamento de base já tratada na mutation)

### Detalhes técnicos
- Reusar hooks já existentes: `useVistoriadoresAtivos`, `useAtribuirServicoManual`, `useAlocacoesDiaHoje` (para pintar o badge Rota/Base).
- Componentes shadcn: `Popover`, `PopoverTrigger`, `PopoverContent`, `Command`/`CommandInput`/`CommandList` (já no projeto).
- Ícone: `UserPlus` do `lucide-react` (adicionar ao import existente).
- `e.stopPropagation()` em todos os handlers (igual aos outros botões da coluna) para não disparar `selecionarVistoria`.
- Determinação de `isBase`: se o serviço pertence a `agendamentos_base`. No contexto deste painel, `v.servico_id_unificado` aponta para `servicos` (rota), portanto `isBase=false`. Manter `false` aqui — alocações de base já têm fluxo próprio.
- Loading: enquanto `atribuirServicoMutation.isPending`, desabilitar a lista e mostrar spinner inline no item clicado.
- Acessibilidade: `aria-label="Atribuir técnico"` no botão.

### Validação após deploy
1. Painel `/monitoramento/mapa` com flag manual ON → cards sem técnico mostram o novo botão `UserPlus`.
2. Card "Sem coordenadas GPS" (ex.: SQY2D63) — drag não funciona mas o botão sim.
3. Clicar → lista de técnicos ativos aparece → clicar em "Wallace" → toast de sucesso, técnico aparece no card e o badge "Não atribuído" some.
4. Reagendar o card e confirmar que ele continua atribuível pelo botão.
5. Confirmar log em `servicos_atribuicoes_log` com `tipo_atribuicao='manual'`.

### Arquivos tocados
- `src/components/mapa/MapaVistoriasContent.tsx` (única alteração)

Sem mudança de schema, hooks ou edge functions.
