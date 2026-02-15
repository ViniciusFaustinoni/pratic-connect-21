
# Pagina de Prazos Completa — Calendario, Lista e Notificacoes

## Resumo

Reescrever completamente o `PrazosControl.tsx` existente para incluir: 5 KPI cards (Hoje, Semana, Mes, Vencidos, Total Ativos), alternancia Calendario/Lista, visualizacao calendario mensal interativa com painel lateral, lista expandida com coluna Tipo e filtros completos, modal de criacao expandido com tipo/processo/evento/advogado/lembrete, acoes de prorrogar e cancelar, e toggle "Meus prazos / Todos".

## Migracao de Banco

A tabela `processos_prazos` precisa de novas colunas:

```text
ALTER TABLE public.processos_prazos
  ADD COLUMN IF NOT EXISTS tipo varchar DEFAULT 'judicial',
  ADD COLUMN IF NOT EXISTS evento_id uuid REFERENCES sinistros(id),
  ADD COLUMN IF NOT EXISTS hora_vencimento time,
  ADD COLUMN IF NOT EXISTS alerta_enviado_7d boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lembrete_ativo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lembrete_dias integer[] DEFAULT '{7,3,1}',
  ADD COLUMN IF NOT EXISTS prorrogado_de date,
  ADD COLUMN IF NOT EXISTS prorrogacao_motivo text,
  ADD COLUMN IF NOT EXISTS cancelamento_motivo text;
```

Campos:
- `tipo`: judicial, sindicancia, ressarcimento, documentacao, recuperacao, notificacao, garantia, administrativo, outro
- `evento_id`: vinculacao opcional a um evento/sinistro (alternativa ao processo)
- `hora_vencimento`: para audiencias e prazos com hora especifica
- `alerta_enviado_7d`: flag para notificacao de 7 dias
- `lembrete_ativo`: se o lembrete automatico esta ativo
- `lembrete_dias`: array com os dias de antecedencia para lembrete
- `prorrogado_de`: data original antes da prorrogacao
- `prorrogacao_motivo`: motivo da prorrogacao
- `cancelamento_motivo`: motivo do cancelamento

## Arquivos a Modificar

### 1. `src/types/juridico.ts`

Adicionar novos tipos e labels:

```text
export type TipoPrazo = 'judicial' | 'sindicancia' | 'ressarcimento' | 'documentacao' | 'recuperacao' | 'notificacao' | 'garantia' | 'administrativo' | 'outro';

export const TIPO_PRAZO_LABELS: Record<TipoPrazo, string> = {
  judicial: 'Judicial',
  sindicancia: 'Sindicância',
  ressarcimento: 'Ressarcimento',
  documentacao: 'Documentação',
  recuperacao: 'Recuperação',
  notificacao: 'Notificação',
  garantia: 'Garantia',
  administrativo: 'Administrativo',
  outro: 'Outro',
};

export const TIPO_PRAZO_COLORS: Record<TipoPrazo, string> = {
  judicial: 'bg-blue-100 text-blue-800',
  sindicancia: 'bg-yellow-100 text-yellow-800',
  ressarcimento: 'bg-green-100 text-green-800',
  documentacao: 'bg-orange-100 text-orange-800',
  recuperacao: 'bg-purple-100 text-purple-800',
  notificacao: 'bg-gray-100 text-gray-800',
  garantia: 'bg-cyan-100 text-cyan-800',
  administrativo: 'bg-pink-100 text-pink-800',
  outro: 'bg-gray-100 text-gray-800',
};
```

### 2. `src/pages/juridico/PrazosControl.tsx` (reescrever)

O componente atual tem 519 linhas com lista basica e 4 KPI cards. Sera reescrito completamente mantendo a mesma rota.

**Estrutura principal:**

Estado de view: `viewMode: 'lista' | 'calendario'`
Estado de toggle: `meusPrazos: boolean` (filtra por `responsavel_id = currentUserId`)
Estado de calendario: `mesSelecionado: Date`, `diaSelecionado: Date | null`

**5 KPI Cards (topo):**

1. "Vencendo Hoje" — count de prazos pendentes com `data_fim = hoje`. Card vermelho se > 0.
2. "Esta Semana" — count de prazos pendentes com `data_fim` entre hoje e hoje+7.
3. "Este Mes" — count de prazos pendentes com `data_fim` entre hoje e hoje+30.
4. "Vencidos em Aberto" — count de prazos com `data_fim < hoje` e `status = pendente`. Sempre vermelho. Card mais critico.
5. "Total Ativos" — count de prazos com `status = pendente`.

Estes KPIs usam uma query separada sem filtros para mostrar numeros reais.

**Barra de acoes (abaixo dos KPIs):**

- Toggle "Meus Prazos / Todos"
- Botoes de alternancia: "Lista" e "Calendario"
- Botao "+ Novo Prazo" (abre NovoPrazoModal expandido)

**Visualizacao Calendario:**

Grid de 7 colunas (Dom-Sab) com as celulas do mes atual. Cada celula:
- Numero do dia
- Se tem prazos: badge numerico colorido pela urgencia mais alta
- Borda azul se e hoje
- Fundo vermelho claro se ja passou e tem prazo pendente nao cumprido
- Clicavel: ao clicar, abre painel lateral direito (Sheet ou panel) com lista de prazos daquele dia

O painel lateral mostra:
- Data selecionada no header
- Lista de prazos: descricao, tipo (badge), processo vinculado (link), advogado, botao "Cumprir" e "Prorrogar"

Navegacao: botoes prev/next mes, botao "Hoje" para voltar ao mes atual.

Dados do calendario: query de todos os prazos do mes selecionado, agrupados por dia no frontend.

**Visualizacao Lista (expandida):**

Tabela completa com colunas:
- Status icon
- Descricao
- Tipo (badge colorido)
- Processo/Evento (numero com link)
- Advogado (responsavel)
- Vencimento (data formatada)
- Dias Restantes (badge com cores: verde > 15d, amarelo 7-15d, laranja 3-7d, vermelho 1-3d, preto/vermelho VENCIDO)
- Status
- Acoes (cumprir, prorrogar, cancelar)

Filtros expandidos:
- Status: Pendentes (padrao), Vencidos, Cumpridos, Cancelados, Todos
- Tipo de prazo (select com os 9 tipos)
- Advogado responsavel (select de advogados)
- Periodo (date range picker ou presets: hoje/semana/mes/vencidos)
- Urgencia (so vencendo em 7d, so vencidos)
- Busca textual

**Modais:**

1. Modal Cumprir (manter existente): observacao + confirmar
2. Modal Prorrogar (novo): nova data de vencimento (date picker), motivo (textarea obrigatorio). Ao salvar: atualiza `data_fim`, salva `prorrogado_de` (data antiga), `prorrogacao_motivo`, registra andamento no processo.
3. Modal Cancelar (novo): motivo (textarea obrigatorio). Ao salvar: atualiza `status = cancelado`, salva `cancelamento_motivo`.

### 3. `src/components/juridico/NovoPrazoModal.tsx` (expandir)

O modal existente e simples e recebe `processoId` obrigatorio. Precisa ser expandido para funcionar de forma autonoma (sem processo pre-vinculado).

Mudancas:
- `processoId` passa a ser opcional
- Adicionar campo "Tipo" (select com 9 tipos)
- Adicionar campo "Processo vinculado" (busca por numero, obrigatorio se tipo = judicial)
- Adicionar campo "Evento vinculado" (busca por protocolo, alternativa ao processo)
- Adicionar campo "Advogado responsavel" (select de advogados ativos)
- Adicionar campo "Hora de vencimento" (time input, opcional)
- Adicionar checkbox "Lembrete automatico?" + campo "Quantos dias antes?" (multi-input ou preset 7,3,1)
- Adicionar campo "Observacoes" (textarea)
- Manter campos existentes: descricao, data inicio, prazo dias / data especifica, prioridade

### 4. `src/hooks/useProcessosPrazos.ts` (expandir)

Atualizar interface `PrazoFilters`:
```text
interface PrazoFilters {
  status?: string;
  responsavel_id?: string;
  processo_id?: string;
  tipo?: string;
  advogado_id?: string;
  data_inicio?: string;
  data_fim_de?: string;
  data_fim_ate?: string;
}
```

Adicionar mutation `prorrogarPrazo`:
```text
mutationFn: async ({ id, novaData, motivo }) => {
  // Buscar data atual do prazo
  // Update com nova data_fim, prorrogado_de = data antiga, prorrogacao_motivo
}
```

Expandir mutation `cancelarPrazo` para aceitar motivo.

Adicionar mutation `criarPrazo` expandida com novos campos (tipo, evento_id, hora_vencimento, lembrete, responsavel_id).

### 5. `src/App.tsx`

Nenhuma mudanca necessaria — a rota `/juridico/prazos` ja existe e aponta para `PrazosControl`.

## Notificacoes Automaticas

O sistema ja tem `alerta_enviado_3d`, `alerta_enviado_1d`, `alerta_enviado_hoje` na tabela. A migracao adiciona `alerta_enviado_7d`. Para a verificacao diaria:

Criar edge function `cron-verificar-prazos` que:
1. Busca todos os prazos com status `pendente`
2. Para cada prazo, calcula dias restantes
3. Se 7 dias e `alerta_enviado_7d = false`: notifica advogado, marca flag
4. Se 3 dias e `alerta_enviado_3d = false`: notifica advogado + diretor, marca flag
5. Se 1 dia e `alerta_enviado_1d = false`: notifica advogado + diretor + admins, marca flag
6. Se hoje e `alerta_enviado_hoje = false`: notificacao vermelha urgente, marca flag
7. Se vencido: notificacao diaria "PRAZO VENCIDO HA X DIAS"

Usa `disparar-notificacao` ja existente para enviar. Agendamento via pg_cron (SQL insert).

A edge function sera simples: busca prazos pendentes, calcula dias, chama disparar-notificacao para cada caso.

## Detalhes Tecnicos

- O calendario e construido manualmente com CSS grid 7 colunas, sem biblioteca extra. Usa `date-fns` para calcular inicio/fim do mes, dia da semana, etc.
- A query do calendario busca todos os prazos do mes selecionado (`data_fim >= primeiro_dia_mes AND data_fim <= ultimo_dia_mes`) para montar o mapa dia -> prazos no frontend.
- O toggle "Meus Prazos" usa o `auth.uid()` do usuario logado para filtrar `responsavel_id`.
- Prazos vencidos NUNCA sao filtrados automaticamente — sempre aparecem na lista pendente com destaque vermelho.
- A coluna `dias_uteis` ja existe na tabela — a UI deve indicar quando um prazo e em dias uteis (badge ou icone).
- Nenhuma dependencia nova necessaria.

## Ordem de Implementacao

1. Migracao: novas colunas em `processos_prazos` (tipo, evento_id, hora_vencimento, alerta_enviado_7d, lembrete, prorrogacao, cancelamento)
2. Atualizar `src/types/juridico.ts` com TipoPrazo, labels e colors
3. Expandir `src/hooks/useProcessosPrazos.ts` com novos filtros e mutations
4. Expandir `src/components/juridico/NovoPrazoModal.tsx` com campos tipo, processo, evento, advogado, hora, lembrete
5. Reescrever `src/pages/juridico/PrazosControl.tsx` com calendario, lista expandida, 5 KPIs, toggle meus/todos
6. Criar edge function `cron-verificar-prazos` para notificacoes diarias
7. Agendar cron job via SQL (pg_cron + pg_net)
