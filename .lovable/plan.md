
# Expansao de Processos Manuais — Tipos, Formulario, Lista e Detalhe

## Resumo

Expandir o modulo de processos judiciais para permitir criacao manual de processos que nao vem de sinistros (danos a terceiros, cobranca judicial, acao do associado, defesa regulatoria, etc). Inclui: novos tipos de processo, campos de parte contraria expandidos, instancia, prioridade, formulario com tipos agrupados, lista com colunas extras e filtro de origem, e decisoes diferenciadas para processos externos vs eventos.

## Migracao de Banco

### Novas colunas na tabela `processos`

```text
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS parte_contraria_tipo varchar DEFAULT 'pessoa_fisica',
  ADD COLUMN IF NOT EXISTS parte_contraria_telefone varchar,
  ADD COLUMN IF NOT EXISTS instancia varchar DEFAULT '1a_instancia',
  ADD COLUMN IF NOT EXISTS prioridade varchar DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS origem varchar DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS decisao varchar,
  ADD COLUMN IF NOT EXISTS decisao_observacoes text,
  ADD COLUMN IF NOT EXISTS decisao_valor numeric,
  ADD COLUMN IF NOT EXISTS decisao_parcelas integer,
  ADD COLUMN IF NOT EXISTS decisao_prazo_recurso date,
  ADD COLUMN IF NOT EXISTS decisao_registrada_em timestamptz,
  ADD COLUMN IF NOT EXISTS decisao_registrada_por uuid;
```

Campos:
- `parte_contraria_tipo`: pessoa_fisica, pessoa_juridica, orgao_publico
- `instancia`: 1a_instancia, 2a_instancia, tribunal_superior, extrajudicial
- `prioridade`: baixa, normal, alta, urgente
- `origem`: sindicancia, evento_direto, manual (para classificar de onde veio o processo)
- `decisao` e campos relacionados: para registrar a decisao final do processo (separado do CasoJuridicoDetalhe que lida com consultas_juridicas)

### Atualizar processos existentes

Os processos ja existentes que tem `sinistro_id` devem receber `origem = 'evento_direto'`. Isso sera feito via SQL de dados (insert tool):

```text
UPDATE processos SET origem = 'evento_direto' WHERE sinistro_id IS NOT NULL AND origem = 'manual';
```

## Arquivos a Modificar

### 1. `src/types/juridico.ts`

**Expandir `TipoProcesso`** para incluir os novos tipos:

Tipos existentes (mantidos): civel, trabalhista, criminal, consumidor, transito, administrativo, tributario, outros

Novos tipos a adicionar:
- sindicancia_fraude
- carta_cancelamento
- questao_legal_evento
- analise_juridica_interna
- indenizacao_documentacao
- danos_terceiros
- cobranca_judicial
- acao_associado
- notificacao_extrajudicial
- defesa_regulatoria
- rescisao_contenciosa

**Atualizar `TIPO_PROCESSO_LABELS`** com os labels dos novos tipos, agrupados para referencia:

```text
Grupo "Eventos e Sinistros":
  sindicancia_fraude: 'Fraude Comprovada'
  carta_cancelamento: 'Carta de Cancelamento'
  questao_legal_evento: 'Questão Legal de Evento'
  analise_juridica_interna: 'Análise Jurídica Interna'
  indenizacao_documentacao: 'Indenização - Documentação'

Grupo "Demandas Externas":
  danos_terceiros: 'Danos a Terceiros'
  cobranca_judicial: 'Cobrança Judicial'
  acao_associado: 'Ação do Associado contra Pratic'
  notificacao_extrajudicial: 'Notificação Extrajudicial'
  defesa_regulatoria: 'Defesa Regulatória'
  rescisao_contenciosa: 'Rescisão Contenciosa'
```

**Novos types e labels:**

```text
export type ParteContrariaTipo = 'pessoa_fisica' | 'pessoa_juridica' | 'orgao_publico';
export type InstanciaProcesso = '1a_instancia' | '2a_instancia' | 'tribunal_superior' | 'extrajudicial';
export type OrigemProcesso = 'sindicancia' | 'evento_direto' | 'manual';
export type DecisaoProcessoExterno = 'procedente' | 'improcedente' | 'acordo_judicial' | 'acordo_extrajudicial' | 'sentenca_favoravel' | 'sentenca_desfavoravel' | 'recurso_interposto' | 'arquivado';

PARTE_CONTRARIA_TIPO_LABELS
INSTANCIA_LABELS
ORIGEM_LABELS
DECISAO_PROCESSO_EXTERNO_LABELS (com descricoes para cada decisao)
```

Adicionar constante `TIPOS_EVENTO` (array dos 5 tipos de evento) e `TIPOS_EXTERNO` (array dos 6 tipos de demanda externa + outros) para uso na logica de formulario e decisao.

### 2. `src/pages/juridico/ProcessoForm.tsx`

Mudancas no formulario de criacao/edicao:

**Campo Tipo**: trocar o Select simples por um Select com optgroups (usando SelectGroup/SelectLabel do Radix):

```text
<SelectGroup>
  <SelectLabel>Eventos e Sinistros</SelectLabel>
  <SelectItem value="sindicancia_fraude">Fraude Comprovada</SelectItem>
  ...
</SelectGroup>
<SelectGroup>
  <SelectLabel>Demandas Externas e Administrativas</SelectLabel>
  <SelectItem value="danos_terceiros">Danos a Terceiros</SelectItem>
  ...
</SelectGroup>
<SelectGroup>
  <SelectLabel>Gerais</SelectLabel>
  <SelectItem value="civel">Cível</SelectItem>
  ...
</SelectGroup>
```

**Novo campo Prioridade**: Select com baixa/normal/alta/urgente, posicionado ao lado do tipo.

**Expandir secao Parte Contraria**:
- Manter: nome (obrigatorio), CPF/CNPJ, advogado, OAB
- Adicionar: Tipo (pessoa_fisica/pessoa_juridica/orgao_publico), Telefone
- Tornar `parte_contraria_nome` opcional (nao obrigatorio) para processos que nao tem parte contraria definida (ex: defesa regulatoria pode nao ter). Ajustar schema zod para `.optional()`.

**Novo campo Instancia**: Select com 1a instancia, 2a instancia, tribunal superior, extrajudicial. Posicionar na secao Tribunal.

**Ajustar Vinculacoes**:
- Sinistro: manter como esta (busca por protocolo)
- Associado: manter como esta (busca por nome/CPF)
- Ambos sao opcionais

**Salvar `origem` automaticamente**:
- Se `sinistro_id` vem da URL (redirecionamento automatico): `origem = 'evento_direto'`
- Se nao tem sinistro_id: `origem = 'manual'`
- Incluir `prioridade`, `parte_contraria_tipo`, `parte_contraria_telefone`, `instancia` no processData

**Atualizar schema zod** para incluir os novos campos.

### 3. `src/pages/juridico/ProcessosList.tsx`

**Nova coluna "Valor"**: adicionar coluna na tabela entre "Parte Contraria" e "Fase" mostrando `valor_causa` formatado como moeda. Se nulo, mostrar "-".

**Novo filtro "Origem"**: adicionar Select no painel de filtros com opcoes: Todos, Sindicancia, Evento Direto, Manual. Filtra por `processo.origem`.

**Expandir filtro Tipo**: o Select de tipo ja usa `TIPO_PROCESSO_LABELS` que sera atualizado com os novos tipos — funciona automaticamente.

**Adicionar coluna "Prioridade"**: badge colorida com a prioridade do processo.

**Atualizar query** para incluir o campo `origem` no filtro:
```text
if (filters.origem && filters.origem !== 'todos') {
  query = query.eq('origem', filters.origem);
}
```

### 4. `src/pages/juridico/ProcessoDetalhe.tsx`

**Aba Resumo — Card "Parte Contraria" expandido**:
- Se tem `parte_contraria_tipo`: mostrar "Tipo: Pessoa Fisica / Pessoa Juridica / Orgao Publico"
- Se tem `parte_contraria_telefone`: mostrar telefone com botao "Ligar"
- Se nao tem parte contraria (nome vazio): nao mostrar o card

**Aba Resumo — Card "Dados Processuais" expandido**:
- Mostrar `instancia` se preenchido
- Mostrar `prioridade` como badge colorida

**Aba Resumo — Cards condicionais**:
- Se nao tem `sinistro_id`: nao mostrar os cards de Sinistro/Evento (ja funciona assim parcialmente)

**Nova aba "Decisao" (7a aba)**:
- Detectar se o processo e de evento (`sinistro_id` preenchido e tipo em TIPOS_EVENTO) ou externo
- **Processo de evento**: mostrar as 7 decisoes do CasoJuridicoDetalhe (aprovado, negado, suspensao, exclusao, acao_judicial, acordo, arquivar) — pode redirecionar para o CasoJuridicoDetalhe se ja tem consulta vinculada
- **Processo externo**: mostrar 8 decisoes novas em RadioGroup:
  1. Procedente — campo: valor a pagar
  2. Improcedente — processo arquivado
  3. Acordo judicial — campos: valor do acordo, parcelas
  4. Acordo extrajudicial — campos: valor, condicoes (texto)
  5. Sentenca favoravel — processo arquivado
  6. Sentenca desfavoravel — campos: valor da condenacao, prazo para recurso (data)
  7. Recurso interposto — campo: observacoes
  8. Arquivado — sem campos extras

Ao registrar decisao:
- Salvar em `processos.decisao`, `decisao_observacoes`, `decisao_valor`, `decisao_parcelas`, `decisao_prazo_recurso`, `decisao_registrada_em`, `decisao_registrada_por`
- Atualizar status do processo conforme decisao (procedente -> encerrado_procedente, improcedente -> encerrado_improcedente, acordo -> acordo, etc)
- Registrar andamento automatico
- Notificar advogado e diretores

**Tabs atualizado**: de 6 para 7 abas (Resumo, Andamentos, Prazos, Audiencias, Decisao, Documentos, Custas)

### 5. `src/hooks/useProcessos.ts`

Atualizar a interface `ProcessoFilters` para incluir `origem`:

```text
interface ProcessoFilters {
  status?: string;
  tipo?: string;
  fase?: string;
  advogado_id?: string;
  associado_id?: string;
  origem?: string;
}
```

Adicionar filtro na query:
```text
if (filters?.origem) query = query.eq('origem', filters.origem);
```

## Detalhes Tecnicos

- O numero sequencial (0025/2026) ja e gerado automaticamente pelo backend (trigger ou logica existente no insert). Nao precisa de mudanca.
- A `origem` e setada automaticamente: se o processo vem de um sinistro (sinistro_id preenchido), e 'evento_direto'; se vem de sindicancia (tipo = sindicancia_fraude), e 'sindicancia'; caso contrario, 'manual'.
- O formulario ja existe como pagina separada (/juridico/processos/novo). O botao "+ Novo Processo" ja existe na lista. Apenas expandimos o formulario.
- A aba Decisao no ProcessoDetalhe e independente da aba Decisao do CasoJuridicoDetalhe. O CasoJuridicoDetalhe lida com consultas_juridicas (casos de eventos). O ProcessoDetalhe lida com processos judiciais.
- Os campos de decisao ficam na propria tabela `processos` para simplicidade, sem criar tabela extra.

## Ordem de Implementacao

1. Migracao: novas colunas em `processos`
2. Atualizar `src/types/juridico.ts` com novos tipos, labels e constantes
3. Atualizar `src/pages/juridico/ProcessoForm.tsx` com tipos agrupados, prioridade, instancia, parte contraria expandida
4. Atualizar `src/pages/juridico/ProcessosList.tsx` com colunas Valor e Prioridade, filtro Origem
5. Atualizar `src/pages/juridico/ProcessoDetalhe.tsx` com aba Decisao e cards expandidos
6. Atualizar `src/hooks/useProcessos.ts` com filtro origem
7. Atualizar processos existentes com `origem` correta (SQL de dados)
