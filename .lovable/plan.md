## Diagnóstico

A tela **Monitoramento › Fila de Vistorias** (`src/pages/monitoramento/FilaVistorias.tsx`) concatena três fontes (`vistorias`, `servicos`, `vistorias_evento`) sem reconhecer quando vistoria e serviço se referem ao mesmo evento físico. Resultado confirmado no banco para o Rodrigo (LME3A49):

- `vistorias.id = 3e90c622…` (modalidade `presencial`, `agendada`, sem técnico) — congela no agendamento original.
- `servicos.id = 77083b8a…` (`vistoria_entrada`, `concluida`, técnico WALLACE NUNES, `vistoria_origem_id = 3e90c622…`) — estado vivo.

A duplicação é puramente de leitura — backend está correto.

## Correção

Aplicar dedup dentro do `useMemo` de `vistorias` em `FilaVistorias.tsx`. Backend e triggers permanecem intactos.

### Regra de consolidação (em ordem)

1. **Vínculo canônico direto** — `servicos.vistoria_origem_id` = `vistorias.id`. Quando casa, descartar a vistoria.
2. **Fallback por instalação** — `servicos.instalacao_origem_id` = `vistorias.instalacao_id`. Quando casa, descartar a vistoria.
3. **Último recurso (legados)** — agrupar o array final por `clienteId + placa + tipo_canônico` (`presencial`/`auto_vistoria`/`ponto_fixo` ≡ `instalacao_like`). Quando o grupo tem mais de um item, manter o de maior prioridade de status, com **vivos > terminais** (`em_rota` > `em_andamento` > `aguardando_analise` > `agendada` > `auto_vistoria_pendente` > `pendente` > `reprovada` > `aprovada`), desempate por `createdAt` mais recente.

### Quem prevalece

Sempre o registro com estado operacional vivo (vindo de `servicos`). A vistoria original é removida — sua data/técnico/status estavam congelados.

### Garantias

- Vistorias **sem serviço associado** (sinistros recém-abertos, eventos puros, vistoria agendada que ainda não materializou serviço) permanecem visíveis.
- Eventos de outros associados não são afetados — chave de agrupamento inclui `clienteId + placa`.
- Contadores no topo (`pendentes`, `emCampo`, `aguardandoAnalise`, `autoVistoria`, `concluidasHoje`) já derivam do array `vistorias` — passam a refletir a contagem deduplicada automaticamente, sem alteração separada.

### Passos

1. **`src/pages/monitoramento/FilaVistorias.tsx`** — único arquivo tocado, somente o `useMemo` que monta `vistorias` (linhas ~185–271):
   - Construir `Set<string>` de `vistoria_origem_id` e `instalacao_origem_id` consumidos a partir de `servicosRaw`.
   - Filtrar `vistoriasRaw` antes do `.map(...)` removendo entradas cujo `id` ou `instalacao_id` esteja consumido.
   - Após concatenar os três blocos, rodar o fallback (cliente+placa+tipo canônico) com a prioridade de status acima.
   - Manter a ordenação final por `createdAt` desc.

### Validação

- Fila de Vistorias → Rodrigo (LME3A49 / VEN-2026-00064) aparece **1 linha**, estado vivo (concluída, WALLACE NUNES, 25/05).
- Contadores no topo refletem a contagem deduplicada.
- VEN-2026-00071 e VEN-2026-00072 continuam visíveis e únicos.
- Pelo menos uma vistoria/sinistro sem serviço materializado continua aparecendo.

## Fora de escopo

- `useServicosCampoUnificado` (já dedupa corretamente).
- Triggers de materialização e a tabela `vistorias`.
- Geração do protocolo `VEN-…` (segue trigger DB existente).</parameter>
</invoke>