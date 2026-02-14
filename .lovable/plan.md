

# Fechamento de Ciclos — Diretoria, Prazo de Ressarcimento, Notificacoes e Visao do Associado

## Resumo

Implementar 5 funcionalidades que garantem o fechamento dos ciclos entre Eventos, Sindicancias e Juridico: (1) decisao da diretoria quando sindicancia inconclusiva, (2) secao "Sindicancias e Juridico" no detalhe do evento, (3) contagem de prazo de ressarcimento com suspensao, (4) notificacoes automaticas para 8 situacoes, (5) visao sanitizada para o associado.

## Migracao de Banco

### Novos status no enum `status_sinistro`

Adicionar os status que o sistema precisa e ainda nao existem:

```text
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'aguardando_diretoria';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'aguardando_juridico';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'aguardando_confirmacoes';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'em_oficina';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'aguardando_peca';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'em_finalizacao';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'concluido';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'entregue';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'finalizado';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'aguardando_indenizacao';
```

### Colunas de prazo de ressarcimento em `sinistros`

Adicionar colunas para controlar o congelamento/descongelamento do prazo:

```text
ALTER TABLE public.sinistros
  ADD COLUMN IF NOT EXISTS prazo_ressarcimento_inicio date,
  ADD COLUMN IF NOT EXISTS prazo_dias_uteis_consumidos integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prazo_suspenso boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS prazo_suspenso_em timestamptz,
  ADD COLUMN IF NOT EXISTS prazo_motivo_suspensao text;
```

### Tabela `sinistro_suspensoes_prazo`

Registrar cada periodo de suspensao para auditoria e calculo preciso:

```text
sinistro_suspensoes_prazo
- id (uuid PK)
- sinistro_id (uuid FK sinistros.id ON DELETE CASCADE)
- motivo (text NOT NULL): sindicancia, juridico, documentacao, inquerito_policial
- inicio (timestamptz NOT NULL)
- fim (timestamptz, nullable — null = ainda suspenso)
- dias_uteis_suspensos (integer DEFAULT 0)
- created_at (timestamptz DEFAULT now())
```

RLS: usuarios autenticados podem ler e inserir.

## Arquivos a Criar

### 1. `src/components/sinistros/BannerAguardandoDiretoria.tsx`

Componente exibido quando `sinistro.status === 'aguardando_diretoria'`.

**Banner amarelo no topo:**
- Icone de alerta + "Este evento aguarda decisao da diretoria. Sindicancia concluida como inconclusiva em DD/MM/AAAA."
- Data extraida do historico (`sinistro_historico` onde `status_novo = 'aguardando_diretoria'`, `created_at` mais recente).

**4 botoes visíveis APENAS para diretores (`isDiretor`) e admin_master:**

1. "Aprovar Evento" — abre dialog com textarea de justificativa obrigatoria. Ao confirmar:
   - Sinistro status -> `aprovado` (ou `aguardando_analise` para retomar fluxo normal)
   - Insere historico com observacao contendo justificativa do diretor
   - Retoma prazo (fecha suspensao em `sinistro_suspensoes_prazo`, seta `prazo_suspenso = false`)
   - Insere notificacao para o analista original

2. "Negar Evento" — abre dialog com textarea de motivo obrigatorio. Ao confirmar:
   - Sinistro status -> `negado`
   - Insere historico
   - Notifica analista

3. "Reabrir Sindicancia" — abre dialog com: motivo (textarea), novo prazo (select 15/30/45/60 dias), novo responsavel (select de profiles com role que permita sindicancia). Ao confirmar:
   - Sinistro status -> `em_sindicancia`
   - Atualiza `sindicante_id`, `sindicancia_prazo_fim`
   - Limpa `resultado_sindicancia`, `parecer_sindicancia`
   - Insere historico
   - Notifica novo responsavel

4. "Encaminhar para Juridico" — reutiliza o `EncaminharJuridicoEventoModal` que ja existe, passando sinistro_id e protocolo.

### 2. `src/components/sinistros/SecaoSindicanciasJuridico.tsx`

Secao colapsavel (Collapsible) para inserir no detalhe do evento.

- Titulo: "Sindicancias e Juridico" com icone de lupa/balanca
- Conteudo:
  - Query `sinistro_historico` filtrado por entradas de sindicancia (status_novo IN em_sindicancia, em_pericia, aguardando_diretoria) para identificar quantas sindicancias houve
  - Query `consultas_juridicas` WHERE sinistro_id = id + `processos` WHERE sinistro_id = id
  - Se tem sindicancias: card para cada uma com tipo, motivo (`motivo_sindicancia` do sinistro), status, resultado (badge), responsavel, prazo, link para `/eventos/sindicancias/{sinistro_id}`
  - Se tem casos juridicos: card para cada um com numero, tipo (badge colorido), status, decisao, advogado, link para `/juridico/casos/{id}`
  - Se nao tem nenhum: texto discreto "Nenhuma sindicancia ou caso juridico vinculado."

### 3. `src/components/sinistros/PrazoRessarcimento.tsx`

Card que mostra o estado do prazo de 60 dias uteis.

- Query `sinistro_suspensoes_prazo` WHERE sinistro_id = id para obter periodos de suspensao
- Calculo de dias uteis:
  - A partir de `prazo_ressarcimento_inicio` (ou `created_at` do sinistro se nulo), contar dias uteis (excluindo sabado e domingo) ate hoje
  - Subtrair dias uteis em que houve suspensao ativa
  - Resultado: X dias uteis consumidos de 60
- Se `prazo_suspenso = true`: badge amarelo "Suspenso desde DD/MM (motivo)"
- Se prazo correndo: badge verde "Em contagem — X de 60 dias uteis"
- Barra de progresso visual
- Se X > 55: alerta vermelho "Prazo proximo do vencimento"
- Se X >= 60: alerta critico "Prazo de ressarcimento VENCIDO"

Funcao utilitaria `calcularDiasUteis(inicio: Date, fim: Date): number` que exclui sabados e domingos.

### 4. `src/components/sinistros/NotificacaoHelper.ts`

Modulo com funcoes helper para criar notificacoes internas (tabela `notificacoes`) a partir do frontend. Cada funcao insere direto na tabela `notificacoes`.

```text
notificarSindicanciaAberta(sinistroId, protocolo, responsavelId, prazoFim)
notificarSindicanciaVencendo7d(sinistroId, protocolo, responsavelId)
notificarSindicanciaVencida(sinistroId, protocolo, responsavelId, analistaId)
notificarSindicanciaConcluida(sinistroId, protocolo, resultado, analistaId)
notificarCasoJuridicoCriado(casoNumero, tipo, advogadoId)
notificarParecerEmitido(casoNumero, analistaId)
notificarDecisaoRegistrada(casoNumero, decisao, analistaId)
notificarAguardandoDiretoria(sinistroId, protocolo)
```

Cada funcao:
- Recebe IDs dos destinatarios
- Para "notificar diretores": query `user_roles` WHERE role = 'diretor' para obter todos os user_ids
- Insere em `notificacoes` com titulo, mensagem, tipo, link, prioridade
- Retorna void (fire and forget)

### 5. Edge Function `cron-verificar-sindicancias`

Cron job diario que verifica prazos de sindicancias:

- Busca sinistros com status IN ('em_sindicancia', 'em_pericia') e `sindicancia_prazo_fim` nao nulo
- Para cada: calcula dias restantes
- Se 7 dias restantes: insere notificacao para `sindicante_id` ("vence em 7 dias")
- Se prazo ja venceu (hoje > prazo_fim): insere notificacao para sindicante + analista + todos os diretores ("VENCIDA")
- Evita duplicatas verificando se ja existe notificacao do mesmo tipo no mesmo dia

Registrar no pg_cron para rodar 1x por dia as 8h (BRT).

## Arquivos a Modificar

### 6. `src/pages/eventos/SinistroDetalhe.tsx`

Adicionar 3 novos componentes na pagina:

**Banner Diretoria (topo, apos header):**
```text
{sinistro.status === 'aguardando_diretoria' && (
  <BannerAguardandoDiretoria sinistro={sinistro} />
)}
```

**Prazo de Ressarcimento (na sidebar, apos o card de Documentos):**
```text
<PrazoRessarcimento sinistroId={sinistro.id} dataInicio={sinistro.prazo_ressarcimento_inicio || sinistro.created_at} prazoSuspenso={sinistro.prazo_suspenso} prazoSuspensoEm={sinistro.prazo_suspenso_em} motivoSuspensao={sinistro.prazo_motivo_suspensao} />
```

**Secao Sindicancias e Juridico (na coluna principal, apos o card de Sindicancia existente):**
```text
<SecaoSindicanciasJuridico sinistroId={sinistro.id} />
```

Atualizar `statusConfig` para incluir todos os novos status:
```text
aguardando_diretoria: { label: 'Aguard. Diretoria', class: 'bg-amber-100 text-amber-800' },
aguardando_juridico: { label: 'Aguard. Jurídico', class: 'bg-purple-100 text-purple-800' },
aguardando_confirmacoes: { label: 'Aguard. Confirmações', class: 'bg-sky-100 text-sky-800' },
em_oficina: { label: 'Em Oficina', class: 'bg-violet-100 text-violet-800' },
aguardando_peca: { label: 'Aguard. Peça', class: 'bg-orange-100 text-orange-800' },
em_finalizacao: { label: 'Em Finalização', class: 'bg-teal-100 text-teal-800' },
concluido: { label: 'Concluído', class: 'bg-green-100 text-green-800' },
entregue: { label: 'Entregue', class: 'bg-emerald-100 text-emerald-800' },
finalizado: { label: 'Finalizado', class: 'bg-gray-200 text-gray-800' },
aguardando_indenizacao: { label: 'Aguard. Indenização', class: 'bg-pink-100 text-pink-800' },
aguardando_analise: { label: 'Aguard. Análise', class: 'bg-blue-100 text-blue-800' },
pronto_para_oficina: { label: 'Pronto p/ Oficina', class: 'bg-lime-100 text-lime-800' },
pagamento_confirmado: { label: 'Pgto Confirmado', class: 'bg-green-100 text-green-800' },
reprovado: { label: 'Reprovado', class: 'bg-red-100 text-red-800' },
```

### 7. `src/types/sinistros.ts`

Adicionar os novos valores ao tipo `StatusSinistro`, e atualizar `STATUS_SINISTRO_LABELS` e `STATUS_SINISTRO_COLORS` com os novos status.

### 8. `src/types/app-associado.ts`

Atualizar `STATUS_SINISTRO_LABELS` e `STATUS_SINISTRO_COLORS` no contexto do app do associado. Status internos (em_sindicancia, em_pericia, aguardando_diretoria, aguardando_juridico, suspenso, analise_interna) devem todos mapear para o label "Em Analise" para o associado.

### 9. `src/pages/eventos/SindicanciaDetalhe.tsx`

Quando a sindicancia e concluida com resultado "inconclusivo":
- Alterar o status do sinistro para `aguardando_diretoria` (ao inves de `suspenso`)
- Chamar `notificarAguardandoDiretoria()` do NotificacaoHelper
- Criar suspensao de prazo se nao existir

### 10. `src/pages/juridico/CasoJuridicoDetalhe.tsx`

Na aba Decisao, apos registrar a decisao, chamar as funcoes de notificacao:
- `notificarDecisaoRegistrada()` para analista + diretores

### 11. `src/components/sinistros/EncaminharSindicanciaDialog.tsx`

Ao encaminhar para sindicancia:
- Criar registro de suspensao em `sinistro_suspensoes_prazo`
- Atualizar sinistro: `prazo_suspenso = true`, `prazo_suspenso_em = now()`, `prazo_motivo_suspensao = 'sindicancia'`
- Chamar `notificarSindicanciaAberta()`

### 12. `src/components/sinistros/EncaminharJuridicoEventoModal.tsx`

Ao encaminhar para juridico:
- Criar registro de suspensao em `sinistro_suspensoes_prazo`
- Atualizar sinistro: `prazo_suspenso = true`, `prazo_suspenso_em = now()`, `prazo_motivo_suspensao = 'juridico'`
- Atualizar status para `aguardando_juridico` (ao inves de `suspenso`)

### 13. Atualizar `disparar-notificacao` Edge Function

Adicionar novos templates para as 8 situacoes:

```text
sindicancia: {
  aberta: { titulo: 'Nova Sindicância', mensagem: 'Sindicância aberta para evento #{protocolo}. Prazo: {prazo}.' },
  vencendo: { titulo: 'Sindicância Vencendo', mensagem: 'Sindicância do evento #{protocolo} vence em 7 dias.' },
  vencida: { titulo: 'Sindicância VENCIDA', mensagem: 'Sindicância do evento #{protocolo} está VENCIDA.' },
  concluida: { titulo: 'Sindicância Concluída', mensagem: 'Resultado da sindicância #{protocolo}: {resultado}.' },
}
juridico: {
  caso_criado: { titulo: 'Novo Caso Jurídico', mensagem: 'Caso #{numero} criado: {tipo}.' },
  parecer: { titulo: 'Parecer Jurídico Emitido', mensagem: 'Parecer emitido no caso #{numero}.' },
  decisao: { titulo: 'Decisão Registrada', mensagem: 'Decisão: {decisao} no caso #{numero}.' },
}
sinistro: {
  aguardando_diretoria: { titulo: 'Evento Aguarda Diretoria', mensagem: 'Evento #{protocolo} aguarda decisão da diretoria.' },
}
```

## Detalhes Tecnicos

- A funcao `calcularDiasUteis` percorre cada dia entre inicio e fim, incrementando apenas se nao for sabado nem domingo. Periodos de suspensao sao subtraidos usando a tabela `sinistro_suspensoes_prazo`.
- O `prazo_ressarcimento_inicio` e setado automaticamente quando o sinistro e aberto (trigger ou no momento da criacao). Se for nulo, usar `created_at` do sinistro.
- O cron job `cron-verificar-sindicancias` roda diariamente. Usa `notificacoes` com check de duplicata: antes de inserir, verifica se ja existe notificacao com mesmo `referencia_tipo` + `referencia_id` + `tipo` criada hoje.
- A visao do associado e controlada nos labels: todos os status internos mapeiam para "Em Analise" tanto no app quanto nas mensagens WhatsApp. Nenhum template de WhatsApp menciona sindicancia, fraude ou juridico.
- O `BannerAguardandoDiretoria` usa `usePermissions()` para mostrar botoes apenas para diretores.

## Ordem de Implementacao

1. Migracao: novos status no enum + colunas de prazo + tabela de suspensoes
2. `NotificacaoHelper.ts` — funcoes de notificacao
3. `PrazoRessarcimento.tsx` — card de prazo com calculo de dias uteis
4. `BannerAguardandoDiretoria.tsx` — banner + botoes de decisao
5. `SecaoSindicanciasJuridico.tsx` — secao colapsavel
6. Modificar `SinistroDetalhe.tsx` — integrar os 3 novos componentes + atualizar statusConfig
7. Modificar `sinistros.ts` + `app-associado.ts` — novos status e labels
8. Modificar `SindicanciaDetalhe.tsx` — mudar para aguardando_diretoria quando inconclusivo
9. Modificar `EncaminharSindicanciaDialog.tsx` — suspender prazo ao encaminhar
10. Modificar `EncaminharJuridicoEventoModal.tsx` — suspender prazo ao encaminhar
11. Modificar `CasoJuridicoDetalhe.tsx` — chamar notificacoes na decisao
12. Atualizar `disparar-notificacao` — novos templates
13. Criar `cron-verificar-sindicancias` — edge function + pg_cron

