

# Parecer Tecnico do Regulador + Orcamento Oficial do Analista

## Resumo

Criar dois formularios distintos para o fluxo de reparo de colisao:

1. **Parecer Tecnico do Regulador** -- formulario expandido que o regulador preenche durante a regulagem, com avaliacao de gravidade, fotos tecnicas, lista estimada de pecas/servicos com prioridades, e recomendacao. Substitui/expande o formulario atual `VistoriaEventoOrcamento`.

2. **Orcamento Oficial do Analista** -- o analista preenche com os valores reais da oficina apos receber o parecer. Pode importar itens do parecer como ponto de partida, com comparativo visual entre estimativa do regulador e valor real.

---

## Analise do Estado Atual

### O que ja existe

- **Tabela `vistorias_evento`**: armazena dados da vistoria do regulador em `dados_vistoria` (JSONB). Ja contem `tipo_dano`, `descricao_tecnica`, `itens_orcamento`, `parecer_tecnico`, `recomendacao`, `etapas_reparo`.
- **Componente `VistoriaEventoOrcamento.tsx`**: formulario atual do regulador com diagnostico, etapas de reparo, e lista de itens (peca/mao_de_obra/servico) com valores.
- **Edge Function `salvar-vistoria-regulador`**: salva midias e finaliza a vistoria, mudando status do sinistro para `aguardando_analise`.
- **`CardOrcamentoReparo`**: orcamento vivo que ja funciona com dois caminhos (cotacao separada / pacote fechado). Usa tabelas `orcamento_reparo`, `orcamento_reparo_itens`, `orcamento_reparo_historico`.
- **Campos no sinistro**: `regulagem_parecer`, `regulagem_tipo_dano`, `regulagem_concluida_em`.
- **Card "Dados da Regulagem"** na SinistroAnalise (linha ~2274): mostra tipo de dano e parecer de forma minima.
- **Status `aguardando_regulagem` -> `aguardando_orcamento`**: transicao ja definida em `types/sinistros.ts`.

### O que falta

- O formulario do regulador nao tem: gravidade (leve/moderado/grave/PT), fotos tecnicas dedicadas, origem sugerida de pecas, prioridade por item (essencial/necessario/opcional), prazo estimado, observacoes finais, campo de recomendacao expandido.
- O analista nao tem tela dedicada para preencher o orcamento oficial com base no parecer.
- Nao existe funcionalidade de "importar itens do parecer" para o orcamento.
- O card de regulagem na SinistroAnalise e muito basico -- nao mostra itens, fotos, nem estimativas.

---

## Parte 1: Migracao SQL

Criar tabela dedicada para o parecer tecnico (ao inves de depender apenas do JSONB `dados_vistoria`):

### Nova tabela: `parecer_tecnico_regulador`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| sinistro_id | uuid FK -> sinistros UNIQUE | Evento vinculado |
| vistoria_id | uuid FK -> vistorias_evento | Vistoria de origem |
| regulador_id | uuid FK -> auth.users | Quem preencheu |
| gravidade | text NOT NULL | 'leve', 'moderado', 'grave', 'possivel_perda_total' |
| descricao_tecnica | text NOT NULL | Descricao detalhada dos danos |
| prazo_estimado | text | 'ate_5_dias', '5_a_15', '15_a_30', '30_a_60', 'mais_60' |
| prazo_observacao | text | Obs sobre prazo |
| observacoes_gerais | text | Informacoes adicionais |
| recomendacao | text | 'seguir_reparo', 'segunda_avaliacao', 'avaliar_perda_total', 'pericia_tecnica' |
| estimativa_total | numeric(12,2) DEFAULT 0 | Soma das estimativas |
| created_at | timestamptz | Criacao |

### Nova tabela: `parecer_tecnico_itens`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| parecer_id | uuid FK -> parecer_tecnico_regulador ON DELETE CASCADE | Parecer pai |
| tipo | text NOT NULL | 'peca' ou 'servico' |
| descricao | text NOT NULL | Nome da peca/servico |
| origem_sugerida | text | 'original', 'seminova', 'paralela', 'qualquer' (so peca) |
| quantidade | numeric DEFAULT 1 | Quantidade |
| valor_estimado | numeric(12,2) DEFAULT 0 | Estimativa do regulador |
| prioridade | text DEFAULT 'necessario' | 'essencial', 'necessario', 'opcional' |
| observacao | text | Obs tecnica |
| created_at | timestamptz | Criacao |

### Nova tabela: `parecer_tecnico_fotos`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| parecer_id | uuid FK -> parecer_tecnico_regulador ON DELETE CASCADE | Parecer pai |
| arquivo_url | text NOT NULL | URL da foto |
| descricao | text | Descricao da foto |
| created_at | timestamptz | Criacao |

### RLS Policies

- SELECT em todas: `has_role(auth.uid(), 'regulador')` OR `has_role(auth.uid(), 'analista_eventos')` OR `has_role(auth.uid(), 'diretor')`
- INSERT/UPDATE `parecer_tecnico_regulador`: `has_role(auth.uid(), 'regulador')` OR `has_role(auth.uid(), 'diretor')`
- INSERT `parecer_tecnico_itens` e `parecer_tecnico_fotos`: mesmas roles de insert

### Storage

Usar bucket existente `sinistro-eventos` para fotos tecnicas do parecer (path: `{sinistro_id}/parecer-tecnico/`).

---

## Parte 2: Hook `useParecerTecnico.ts`

Novo hook com:

- `useParecerTecnico(sinistroId)` -- busca parecer completo com itens e fotos, join em profiles para nome do regulador
- `useParecerTecnicoItens(parecerId)` -- lista itens do parecer
- `useParecerTecnicoFotos(parecerId)` -- lista fotos do parecer
- `useSalvarParecerTecnico()` -- mutation que cria parecer + itens + atualiza status do sinistro para `aguardando_orcamento`
- `useUploadFotoParecer()` -- upload para storage + insert na tabela de fotos

---

## Parte 3: Formulario do Regulador (expandido)

### Refatorar: `src/components/regulador/VistoriaEventoOrcamento.tsx`

O formulario atual sera expandido significativamente. Manter como dialog fullscreen mas reorganizar em secoes:

**Secao 1: Avaliacao Geral do Dano**
- Select de gravidade: Leve / Moderado / Grave / Possivel Perda Total (novo)
- Textarea descricao tecnica (manter existente, adicionar minimo 50 chars)
- Upload de fotos tecnicas (minimo 3, ate 20, 5MB cada) com descricao opcional por foto (novo)

**Secao 2: Itens necessarios (estimativa)**
- Titulo e subtitulo explicativo ("Valores estimados com base na sua experiencia...")
- Manter lista de itens existente mas adicionar:
  - Campo "Origem sugerida" (select: original/seminova/paralela/qualquer) para pecas
  - Campo "Prioridade" (select: essencial/necessario/opcional) para cada item
  - Campo "Valor estimado unitario" para TODOS os itens (hoje pecas nao tem valor)
  - Campo "Observacao tecnica" por item
- Manter botoes "+ Adicionar Peca" e "+ Adicionar Servico"
- Tabela preview com subtotais e total estimado
- Alerta se estimativa > 75% FIPE

**Secao 3: Prazo estimado** (novo)
- Select: ate 5 dias / 5-15 / 15-30 / 30-60 / mais de 60
- Textarea observacao sobre prazo

**Secao 4: Observacoes e Recomendacao** (expandido)
- Textarea observacoes gerais
- Select recomendacao: Seguir com reparo / Segunda avaliacao / Avaliar PT / Pericia tecnica (expandido do atual "aprovar" / "analise_detalhada")

**Ao finalizar:**
1. Salva na nova tabela `parecer_tecnico_regulador` + itens + fotos
2. Muda status do sinistro para `aguardando_orcamento` (nao mais `aguardando_analise`)
3. Cria notificacao para analista com resumo
4. Se estimativa > 75% FIPE: notifica diretor tambem
5. Atualiza `regulagem_concluida_em`, `regulagem_parecer`, `regulagem_tipo_dano` no sinistro (manter compatibilidade)

### Atualizar Edge Function `salvar-vistoria-regulador`

Modificar a acao `finalizar` para:
- Inserir na tabela `parecer_tecnico_regulador` e `parecer_tecnico_itens`
- Mudar status para `aguardando_orcamento` ao inves de `aguardando_analise`
- Manter gravacao no `dados_vistoria` JSONB para compatibilidade

---

## Parte 4: Card Parecer do Regulador na SinistroAnalise

### Novo componente: `src/components/orcamento/CardParecerRegulador.tsx`

Card destacado (borda teal) que substitui o card basico atual "Dados da Regulagem" (linhas 2274-2302 do SinistroAnalise):

- Cabecalho: nome do regulador, data, badge de gravidade colorido
- Descricao tecnica completa
- Galeria de fotos tecnicas (thumbnails clicaveis com lightbox)
- Tabela de itens estimados (somente leitura):
  | Descricao | Tipo | Origem Sugerida | Qtd | Estimativa | Prioridade |
- Rodape com totais: estimativa pecas, servicos, total, % FIPE
- Prazo estimado
- Recomendacao com badge
- Observacoes gerais

Este card aparece na tela de analise do evento quando `aguardando_orcamento` ou apos.

---

## Parte 5: Orcamento Oficial do Analista

### Atualizar: `src/components/orcamento/CardOrcamentoReparo.tsx`

Quando o evento esta no status `aguardando_orcamento` e o analista vai criar o orcamento, alem do modal de escolha de tipo (cotacao separada / pacote fechado), adicionar:

**Botao "Importar itens do parecer"** (novo)

Aparece na tela de cotacao separada, logo apos criar o orcamento. Ao clicar:
- Copia todos os itens do `parecer_tecnico_itens` para `orcamento_reparo_itens`
- Descricao, tipo, origem, quantidade sao copiados
- Valor unitario fica com a estimativa do regulador como valor inicial (editavel)
- Status = 'pendente'
- Motivo = 'Importado do parecer tecnico do regulador'
- Registra no historico

**Coluna "Estimativa Regulador"** (novo)

Na tabela de itens do orcamento, adicionar coluna que busca o valor estimado correspondente no parecer tecnico (por match de descricao ou por referencia):
- Se o valor da oficina for > 30% acima da estimativa: badge amarelo
- Se > 50%: badge vermelho
- Apenas visual, nao bloqueia

**Rodape expandido** (novo)

Apos os totais do orcamento, mostrar:
- Estimativa do regulador era: R$ X.XXX
- Diferenca: +/- R$ XXX (+/- XX%)

### Para Pacote Fechado

No `FormPacoteFechado`, apos preencher o valor do pacote:
- Mostrar comparativo com estimativa do regulador automaticamente
- "Estimativa do regulador: R$ X.XXX | Pacote negociado: R$ X.XXX | Diferenca: +/- XX%"

---

## Parte 6: Integracao no SinistroAnalise

### Arquivo: `src/pages/eventos/SinistroAnalise.tsx`

1. **Substituir card basico de regulagem** (linhas 2274-2302) pelo novo `CardParecerRegulador` completo

2. **Na aba "Orcamento"** (linha 1644): manter `CardOrcamentoReparo` mas passar prop adicional `parecerTecnico` com os dados do parecer para exibir comparativos

3. **Card de acoes**: quando status = `aguardando_orcamento`, mostrar botao de acao para criar orcamento (ja funciona via CardOrcamentoReparo na aba correspondente)

---

## Parte 7: Fluxo de Status

A transicao ja esta definida:
- `aguardando_regulagem` -> regulador conclui vistoria -> `aguardando_orcamento`
- `aguardando_orcamento` -> analista aprova orcamento -> `aguardando_pecas` ou `em_reparo`

Atualizar a Edge Function para usar `aguardando_orcamento` ao inves de `aguardando_analise` quando o regulador finaliza a vistoria.

---

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| Nova migracao SQL | Tabelas `parecer_tecnico_regulador`, `parecer_tecnico_itens`, `parecer_tecnico_fotos`, RLS |
| `src/hooks/useParecerTecnico.ts` | Novo hook CRUD |
| `src/components/regulador/VistoriaEventoOrcamento.tsx` | Expandir formulario com gravidade, fotos, prioridade, origem, prazo |
| `src/components/orcamento/CardParecerRegulador.tsx` | Novo card completo do parecer (substitui card basico) |
| `src/components/orcamento/CardOrcamentoReparo.tsx` | Botao importar do parecer, coluna estimativa, rodape comparativo |
| `src/components/orcamento/FormPacoteFechado.tsx` | Comparativo com estimativa do regulador |
| `src/pages/eventos/SinistroAnalise.tsx` | Integrar CardParecerRegulador, substituir card basico |
| `supabase/functions/salvar-vistoria-regulador/index.ts` | Salvar no parecer_tecnico, mudar status para aguardando_orcamento |

## Sem alteracoes em

- App do associado (nenhuma info de custo)
- Portal do sindicante (nao ve custos)
- Tabela `vistorias_evento` (mantem `dados_vistoria` JSONB para compatibilidade)
- Fluxo de cotacoes WhatsApp
- Tabelas de ordens de servico

