
## Diagnóstico

Hoje a alocação `rota | base` existe na tabela `alocacoes_diarias`, mas:

1. É definida apenas via **EscalaDiaPanel / PlantaoDiaModal** (na aba "Equipe" da gestão), não direto pelo coordenador no mapa de monitoramento.
2. Não há **vínculo com qual base** o técnico fica fixo (`base_id` não existe em `alocacoes_diarias`).
3. No mapa de monitoramento (`MapaVistoriasContent.tsx`), técnicos em modo base **continuam sendo plotados** pelas coordenadas de `vistoriadores_localizacao` e ficam **arrastáveis** (drag-and-drop), permitindo atribuição errada de tarefas de rota.
4. Vistorias de base (`agendamentos_base`) podem ser atribuídas a qualquer técnico, sem checar se ele é base daquela oficina.
5. Ao clicar no ícone da base no mapa, hoje só abre o `CalendarioDiaModal` com a fila — **não mostra quem é o vistoriador fixo da base**.

## Plano

### 1) Schema (migration)

Adicionar coluna `base_id uuid references oficinas(id)` em `alocacoes_diarias`. Constraint: obrigatório quando `tipo_alocacao = 'base'` (via trigger de validação, não CHECK), e a oficina referenciada precisa ter `is_base_pratic = true`.

RLS: garantir que coordenador de monitoramento e diretor têm INSERT/UPDATE em `alocacoes_diarias`.

### 2) Hook `useAlocacoesDiaHoje`

Novo hook que retorna mapa `profissional_id → { tipo_alocacao, base_id }` para o dia atual, consumido pelo `MapaVistoriasContent` e pelo painel de equipe. Realtime sobre `alocacoes_diarias`.

### 3) Mapa de monitoramento — aba Equipe

No popup de cada vistoriador (em `Mapa.tsx` aba `equipe`), adicionar:
- Seletor **Tipo: Rota / Base** (para coordenador/diretor).
- Quando "Base" selecionado → segundo combo **"Em qual base?"** (lista `useBasesPratic`).
- Botão "Salvar" → upsert em `alocacoes_diarias` (data=hoje).

### 4) Mapa de atribuições — esconder técnicos base

Em `MapaVistoriasContent.tsx`:
- Filtrar `vistoriadoresEmServico` para **não renderizar** Markers de quem está em modo base hoje.
- Bloquear drag-and-drop deles (já não aparecem; também blindar lógica de `handleTecnicoDragEnd` para ignorar).
- Vistorias de **rota** sendo arrastadas não podem ser atribuídas a técnico base — `handleTaskDragEnd` filtra técnicos base.

### 5) Ícone da base mostra vistoriador fixo

No popup do Marker da base (linha ~1022-1051), adicionar seção:
- "Vistoriador fixo hoje: **Nome**" com badge verde "Em base".
- Se houver mais de um, lista todos.
- Botão "Reatribuir" abre dialog para trocar técnico daquela base.

### 6) Atribuição manual de vistorias de base

No `useAtribuirServicoManual` (ramo `isBase`):
- Antes de atribuir, validar que o `profissional_id` está alocado como **base na mesma `oficina_id`** do `agendamentos_base`. Se não, rejeitar com mensagem clara.

Na lista de técnicos disponíveis para drag/atribuição de vistoria base, mostrar **apenas** quem é base daquela oficina.

### 7) `useFilaBaseHoje`

Filtrar `disponiveis` adicionalmente por `oficina_id == base_id_do_profissional` quando o profissional for base. Garante que cada técnico base só vê fila da sua oficina.

### 8) `EscalaDiaPanel` / `PlantaoDiaModal`

Adicionar coluna/campo "Base" ao lado do toggle Rota/Base — combo de oficinas (`useBasesPratic`) habilitado quando tipo = "base". Persistir `base_id` no upsert.

## Arquivos a tocar

- **Migration nova**: coluna `base_id` + trigger de validação + (se preciso) policies RLS.
- `src/hooks/useAlocacaoDiaria.ts` — expor `baseId`.
- `src/hooks/useAlocacoesDiaHoje.ts` (novo) — mapa para o dia.
- `src/hooks/useFilaBaseHoje.ts` — filtrar por `oficina_id`.
- `src/hooks/useAtribuicaoManual.ts` — validar base na atribuição.
- `src/pages/monitoramento/Mapa.tsx` — popup vistoriador (aba Equipe) com seletor.
- `src/components/mapa/MapaVistoriasContent.tsx` — esconder técnicos base, popup da base mostrar fixo, filtros drag.
- `src/components/equipe/EscalaDiaPanel.tsx` + `PlantaoDiaModal.tsx` — campo `base_id`.

## Não vou mexer

- Lógica de execução de vistoria (`ExecutarVistoriaCompleta`).
- Reagendamento manual (já implementado).
- Aba Atribuições funciona igual para técnicos de rota.
- `useIniciarServico` (já valida proximidade base via outro caminho).

## Resultado

Coordenador de monitoramento abre o mapa, clica num técnico → muda para **Base** → escolhe **qual base** → técnico desaparece do mapa de atribuições. Ao clicar no ícone da base, vê **quem é o fixo**. Vistorias da base só podem ser atribuídas a técnicos daquela base. Técnicos base não recebem mais drag-and-drop nem aparecem como destino possível para tarefas de rota.
