
# Pagina de Audiencias Completa — Calendario, Lista, Detalhe e Notificacoes

## Resumo

Reescrever completamente o `AudienciasAgenda.tsx` existente com 4 KPI cards (Hoje, Semana, Mes, Pendentes de Registro), novos tipos de audiencia (administrativa, mediacao), calendario expandido com painel lateral Sheet, lista com colunas Partes/Forum/Advogado/Resultado, modal de agendamento expandido com modalidade/advogado/testemunhas/documentos/prazo automatico, e criar pagina de detalhe individual. Expandir hook `useAudiencias` e tabela `processos_audiencias` com novas colunas.

## Migracao de Banco

A tabela `processos_audiencias` precisa de novas colunas para suportar modalidade, advogado responsavel, juiz, testemunhas estruturadas, documentos necessarios, e dados de resultado expandidos:

```text
ALTER TABLE public.processos_audiencias
  ADD COLUMN IF NOT EXISTS modalidade varchar DEFAULT 'presencial',
  ADD COLUMN IF NOT EXISTS forum varchar,
  ADD COLUMN IF NOT EXISTS vara varchar,
  ADD COLUMN IF NOT EXISTS sala varchar,
  ADD COLUMN IF NOT EXISTS endereco_completo text,
  ADD COLUMN IF NOT EXISTS advogado_id uuid REFERENCES advogados(id),
  ADD COLUMN IF NOT EXISTS juiz_orgao varchar,
  ADD COLUMN IF NOT EXISTS testemunhas_lista jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS documentos_necessarios jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS resultado_tipo varchar,
  ADD COLUMN IF NOT EXISTS resultado_valor numeric,
  ADD COLUMN IF NOT EXISTS resultado_condicoes text,
  ADD COLUMN IF NOT EXISTS resultado_prazo_pagamento date,
  ADD COLUMN IF NOT EXISTS resultado_prazo_recurso date,
  ADD COLUMN IF NOT EXISTS resultado_nova_data timestamptz,
  ADD COLUMN IF NOT EXISTS resultado_motivo_adiamento text,
  ADD COLUMN IF NOT EXISTS resultado_resumo text,
  ADD COLUMN IF NOT EXISTS prazo_automatico_criado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS registrado_em timestamptz,
  ADD COLUMN IF NOT EXISTS registrado_por uuid;
```

Campos:
- `modalidade`: presencial, virtual, hibrida
- `forum`, `vara`, `sala`, `endereco_completo`: dados de localizacao detalhados
- `advogado_id`: advogado responsavel por representar a Pratic
- `juiz_orgao`: nome do juiz ou orgao que preside
- `testemunhas_lista`: JSON array com objetos {nome, funcao, confirmado}
- `documentos_necessarios`: JSON array com objetos {descricao, preparado}
- `resultado_tipo`: acordo, conciliacao_frustrada, instrucao_concluida, sentenca, nova_audiencia, adiada, nao_compareceu
- `resultado_valor`, `resultado_condicoes`, etc: campos especificos do resultado
- `prazo_automatico_criado`: flag se o prazo automatico foi criado ao agendar

## Arquivos a Modificar

### 1. `src/types/juridico.ts`

Expandir tipos de audiencia e adicionar novos tipos:

```text
export type TipoAudiencia = 'conciliacao' | 'instrucao' | 'julgamento' | 'administrativa' | 'mediacao' | 'una' | 'especial';

export type ModalidadeAudiencia = 'presencial' | 'virtual' | 'hibrida';

export type ResultadoAudiencia = 'acordo' | 'conciliacao_frustrada' | 'instrucao_concluida' | 'sentenca' | 'nova_audiencia' | 'adiada' | 'nao_compareceu';

// Adicionar 'nao_compareceu' ao StatusAudiencia
export type StatusAudiencia = 'agendada' | 'realizada' | 'adiada' | 'cancelada' | 'redesignada' | 'nao_compareceu';
```

Adicionar labels e colors para:
- TIPO_AUDIENCIA_LABELS: administrativa -> 'Administrativa', mediacao -> 'Mediação'
- TIPO_AUDIENCIA_COLORS: conciliacao -> verde, instrucao -> azul, julgamento -> roxo, administrativa -> cinza, mediacao -> laranja
- MODALIDADE_AUDIENCIA_LABELS
- RESULTADO_AUDIENCIA_LABELS com descricoes
- STATUS_AUDIENCIA_LABELS e COLORS: adicionar nao_compareceu -> vermelho

### 2. `src/hooks/useAudiencias.ts`

Expandir interface `Audiencia`:
- Adicionar todos os novos campos da migracao
- Expandir a query select para incluir `advogado:advogados(id, nome, oab, oab_estado)`

Expandir `AudienciasFilters`:
- Adicionar: `advogado_id`, `processo_id`

Adicionar mutations:
- `criarAudiencia`: insert completo com todos os novos campos. Apos criar, se `prazo_automatico` = true, criar prazo na tabela `processos_prazos` com tipo='judicial', lembrete_dias=[7,3,1]
- `registrarResultado`: update expandido que:
  - Salva resultado_tipo, resultado_valor, resultado_resumo, etc
  - Atualiza status conforme resultado (acordo -> realizada, nao_compareceu -> nao_compareceu, etc)
  - Se resultado_tipo = 'nova_audiencia': cria nova audiencia automaticamente com resultado_nova_data
  - Se resultado_tipo = 'sentenca' e resultado_prazo_recurso: cria prazo automatico de recurso
  - Registra andamento no processo vinculado
  - Define registrado_em e registrado_por

### 3. `src/components/juridico/NovaAudienciaModal.tsx` (reescrever)

Expandir para modal grande com todas as secoes:

- `processoId` passa a ser opcional (pode buscar processo)
- Campo "Processo vinculado": busca por numero do processo (obrigatorio). Ao selecionar, puxa partes do processo.
- Campo "Tipo": select expandido com administrativa e mediacao
- Campos "Data" e "Hora": manter
- Campo "Modalidade": radio group (presencial, virtual, hibrida)
  - Se presencial ou hibrida: campos forum, vara, sala, endereco completo
  - Se virtual ou hibrida: campo link videoconferencia
- Campo "Advogado representante": select dos advogados ativos (obrigatorio)
- Campo "Juiz / Orgao": input texto opcional
- Secao "Testemunhas da Pratic": lista dinamica. Cada item: nome, funcao, checkbox confirmado. Botoes adicionar/remover.
- Secao "Documentos necessarios": lista dinamica. Cada item: descricao do documento, checkbox "Ja preparado?". Botoes adicionar/remover.
- Campo "Observacoes/Pauta": textarea
- Checkbox "Criar prazo automaticamente?" (default: sim). Se marcado, cria prazo com lembretes de 7, 3 e 1 dia.

### 4. `src/pages/juridico/AudienciasAgenda.tsx` (reescrever)

**4 KPI Cards (topo):**

1. "Hoje" — count de audiencias agendadas com data_hora = hoje. Destaque vermelho/urgente se > 0.
2. "Esta Semana" — proximos 7 dias, status agendada.
3. "Este Mes" — proximos 30 dias, status agendada.
4. "Pendentes de Registro" — audiencias com status 'agendada' e data_hora < agora (ja passaram e ninguem registrou resultado). Sempre vermelho.

KPIs usam query separada sem filtros de periodo para refletir numeros reais.

**Barra de acoes:**
- Toggle Calendario / Lista (manter)
- Botao "+ Agendar Audiencia" (abre NovaAudienciaModal expandido)
- Filtros: status, tipo, advogado (select de advogados), busca

**Calendario (expandido):**
- Grid mensal como ja existe, mas com melhorias:
  - Badge numerico com cor da urgencia mais alta (pendente registro = vermelho, hoje = laranja, futuro = azul)
  - Celulas de dias passados com audiencias nao registradas: fundo vermelho claro
  - Ao clicar dia: abre Sheet lateral (em vez de card fixo) com lista de audiencias do dia
  - Cada audiencia no Sheet mostra: hora, tipo badge, processo link, partes, advogado, local/virtual, botoes "Ver Detalhe" e "Registrar Resultado"

**Lista (expandida):**
Tabela com colunas:
- Data/Hora
- Tipo (badge colorido por tipo)
- Processo (numero como link)
- Partes (resumo: "Pratic Car x [parte contraria]")
- Forum/Vara (ou "Virtual — [plataforma]" se virtual)
- Advogado (nome do advogado atribuido)
- Status (badge)
- Resultado (texto curto se preenchido, "-" se nao)
- Acoes (ver detalhe, registrar resultado)

Filtros completos: status, tipo, advogado, periodo, busca textual.

### 5. `src/pages/juridico/AudienciaDetalhe.tsx` (novo)

Pagina completa acessivel por `/juridico/audiencias/:id`.

**Header:** data/hora, tipo badge, status badge, processo como link. Botao "Voltar" e botao "Editar" (abre modal de edicao).

**Card "Informacoes da Audiencia":**
Todos os dados cadastrados: tipo, modalidade, forum/vara/sala, advogado, juiz, horario. Se virtual, link da videoconferencia como botao clicavel "Entrar na Videoconferencia". Se hibrida, mostra ambos.

**Card "Processo Vinculado":**
Resumo do processo: numero, tipo, partes (Pratic x parte contraria), status, prioridade. Link "Ver processo completo" -> /juridico/processos/:id.

**Card "Preparacao":**
- Testemunhas listadas com status (confirmado/pendente/dispensado). Toggle para marcar confirmacao.
- Documentos necessarios com checkbox de controle "Ja preparado?". Toggle inline.
- Botao "Ver documentos do processo" -> navega para aba documentos do processo vinculado.

**Secao "Registro da Audiencia" (aparece quando data_hora < agora e status = agendada ou sempre visivel se ja registrado):**

Se nao registrado:
- Select "O que aconteceu?":
  1. Acordo alcancado -> campos: valor do acordo, condicoes, prazo para pagamento
  2. Conciliacao frustrada -> campo: observacoes
  3. Instrucao concluida -> campo: resumo das provas produzidas
  4. Sentenca proferida -> campos: favoravel/desfavoravel (select), valor da condenacao, prazo para recurso (date)
  5. Nova audiencia designada -> campo: data da proxima (datetime)
  6. Audiencia adiada -> campos: motivo, nova data
  7. Pratic nao compareceu -> campo: motivo (GRAVE — destaque visual)

- Campo "Resumo detalhado" — textarea obrigatorio
- Botao "Registrar Resultado"

Se ja registrado: mostra os dados de resultado como leitura, com badge de tipo de resultado.

Ao registrar:
- Audiencia muda status conforme resultado
- Se "Nova audiencia designada": CRIA nova audiencia automaticamente
- Se "Sentenca" com prazo recurso: CRIA prazo automatico
- Registra andamento no processo: "Audiencia de [tipo] realizada em DD/MM. Resultado: [X]"
- Marca registrado_em e registrado_por

### 6. `src/App.tsx`

Adicionar rota:
```text
/juridico/audiencias/:id -> AudienciaDetalhe
```

Importar AudienciaDetalhe.

### 7. `src/components/layout/GlobalBreadcrumb.tsx`

Adicionar pattern para `/juridico/audiencias/:id` com label dinamico.

## Notificacoes

Expandir a edge function `cron-verificar-prazos` (ja existente) para tambem verificar audiencias:
- 3 dias antes: notifica advogado "Audiencia de [tipo] em 3 dias — Verifique documentacao e testemunhas"
- 1 dia antes: notifica advogado "Audiencia AMANHA — [horario] — [forum]"
- No dia: notifica advogado "Audiencia HOJE as [hora] — [forum/link]"
- 48h apos sem registro: notifica advogado "Audiencia de DD/MM nao foi registrada. Registre o resultado."

Isso e feito adicionando uma secao na mesma edge function, buscando `processos_audiencias` com status 'agendada'.

## Detalhes Tecnicos

- O calendario usa o mesmo pattern do PrazosControl: CSS grid 7 colunas, date-fns para calculos, Sheet para painel lateral.
- Testemunhas e documentos necessarios sao armazenados como JSONB arrays para flexibilidade, sem criar tabelas extras.
- A criacao automatica de nova audiencia (quando resultado = 'nova_audiencia') reutiliza a mesma mutation de criar, preenchendo os dados basicos.
- A criacao automatica de prazo de recurso (quando resultado = 'sentenca') insere em `processos_prazos` com tipo='judicial'.
- Nenhuma dependencia nova necessaria.

## Ordem de Implementacao

1. Migracao: novas colunas em `processos_audiencias`
2. Atualizar `src/types/juridico.ts` com novos tipos, labels e colors de audiencia
3. Expandir `src/hooks/useAudiencias.ts` com novos campos, filtros e mutations
4. Reescrever `src/components/juridico/NovaAudienciaModal.tsx` com modalidade, advogado, testemunhas, documentos, prazo automatico
5. Reescrever `src/pages/juridico/AudienciasAgenda.tsx` com 4 KPIs corretos, calendario expandido com Sheet, lista com colunas completas
6. Criar `src/pages/juridico/AudienciaDetalhe.tsx` com cards informativos, preparacao e registro de resultado
7. Atualizar `src/App.tsx` e breadcrumb com nova rota
8. Expandir edge function `cron-verificar-prazos` com alertas de audiencia
