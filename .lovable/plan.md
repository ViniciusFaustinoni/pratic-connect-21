
# Plano: Etapa de Contato Obrigatorio e Badges de Status Operacional

## Visao Geral

Implementar um novo passo obrigatorio no fluxo de tarefas do profissional de campo: **contato previo com o associado** antes de iniciar o percurso. Alem disso, atualizar os badges de status operacional para refletir com maior granularidade a etapa em que o profissional se encontra.

---

## Fluxo Atual vs Novo Fluxo

```text
FLUXO ATUAL:
  Tarefa Atribuida (agendada)
     -> [Iniciar Rota] -> em_rota
        -> [Cheguei no Local] -> em_andamento
           -> [Executar]

NOVO FLUXO:
  Tarefa Atribuida (agendada)
     -> Botoes de contato (WhatsApp / Ligacao) - OBRIGATORIO
        -> [Registra momento do contato no banco]
        -> [Iniciar Percurso] (desbloqueado apos contato)
           -> em_rota
              -> [Cheguei no Local / Iniciar Tarefa] -> em_andamento
                 -> [Executar]
```

---

## Alteracoes no Banco de Dados (Migration)

Adicionar 2 colunas na tabela `servicos`:

| Coluna | Tipo | Default | Descricao |
|--------|------|---------|-----------|
| `contato_realizado_em` | `timestamptz` | `null` | Momento em que o profissional clicou em WhatsApp ou Ligacao |
| `contato_tipo` | `text` | `null` | Tipo do contato: `'whatsapp'` ou `'ligacao'` |

**Porque novas colunas e nao reuso de `confirmacao_whatsapp`?**
O campo `confirmacao_whatsapp` registra a confirmacao automatica enviada pelo sistema ao cliente (matinal / pre-servico). O novo campo `contato_realizado_em` registra a acao **manual do profissional** antes de iniciar o percurso. Sao conceitos distintos.

---

## Atualizacao da RPC `buscar_tarefa_atual_profissional`

Adicionar os 2 novos campos (`contato_realizado_em`, `contato_tipo`) no retorno da funcao, para que o hook `useTarefaAtual` receba essa informacao e o card possa condicionar a habilitacao do botao "Iniciar Percurso".

---

## Alteracoes no Frontend

### 1. Hook `useTarefaAtual.ts`

- Mapear os novos campos `contato_realizado_em` e `contato_tipo` no retorno do hook.
- Expor esses campos no tipo `TarefaAtual`.

### 2. Novo hook `useRegistrarContato.ts`

Mutation que:
- Recebe `tarefaId`, `tipo` (`'whatsapp'` | `'ligacao'`)
- Atualiza `servicos` com `contato_realizado_em = now()` e `contato_tipo = tipo`
- Invalida cache da `tarefa-atual`

### 3. Componente `TarefaAtualCard.tsx` (alteracao principal)

**Quando status = `agendada`:**

- Os botoes de WhatsApp e Ligacao (que ja existem) passam a chamar tambem `useRegistrarContato` alem de abrir o link externo.
- O botao "Iniciar Rota" e renomeado para **"Iniciar Percurso"**.
- O botao "Iniciar Percurso" fica **desabilitado** enquanto `contato_realizado_em` for `null`.
- Exibir mensagem de orientacao: "Entre em contato com o associado antes de iniciar o percurso".
- Apos o clique em WhatsApp ou Ligacao, mostrar feedback visual (check verde ao lado do botao clicado e desbloquear "Iniciar Percurso").

**Quando status = `em_rota`:**
- Manter botoes "Navegar" e "Cheguei no Local" como esta (sem alteracao).

**Quando status = `em_andamento`:**
- Manter botao "Executar" como esta (sem alteracao).

### 4. Status Operacional - Novo valor `em_contato`

**Tipo `StatusOperacional`** no `useEquipe.ts`:
- Adicionar o valor `'em_contato'` ao tipo union.
- Valores finais: `'em_contato' | 'em_andamento' | 'em_rota' | 'disponivel_operacional' | 'offline'`

**Logica de determinacao (em `useEquipe.ts`):**
```text
Se nao esta em servico -> offline
Se esta em servico:
  - Se tarefa em_andamento -> 'em_andamento' (label: "Realizando Tarefa")
  - Se tarefa em_rota -> 'em_rota' (label: "Em Rota")
  - Se tarefa agendada E contato_realizado_em != null -> 'em_contato' (label: "Em Contato com Associado")
  - Se tarefa agendada E contato_realizado_em == null -> 'disponivel_operacional' (label: "Aguardando Atribuicao")
  - Se sem tarefa -> 'disponivel_operacional' (label: "Aguardando Atribuicao")
```

**Nota:** O hook `useEquipe` atualmente busca tarefas ativas na tabela `instalacoes`. Sera necessario atualizar para buscar tambem na tabela `servicos` (que e a tabela unificada e atual), incluindo o campo `contato_realizado_em`.

### 5. Labels e cores dos badges

| Status Operacional | Label Atual | Nova Label | Cor |
|---------------------|-------------|------------|-----|
| `em_andamento` | Em Andamento | **Realizando Tarefa** | Azul (mantem) |
| `em_rota` | Em Rota | **Em Rota** (mantem) | Roxo (mantem) |
| `em_contato` | -- (novo) | **Em Contato com Associado** | Amarelo/Amber |
| `disponivel_operacional` | Online | **Aguardando Atribuicao** | Verde (mantem) |
| `offline` | Offline | **Offline** (mantem) | Cinza (mantem) |

### 6. Componentes de monitoramento afetados

**`EquipeCard.tsx`:**
- Adicionar config para o novo status `em_contato` em `STATUS_OPERACIONAL_CONFIG`.
- Icone: `MessageCircle` (lucide).
- Cor da barra topo: gradiente amber.

**`EquipeFilters.tsx`:**
- Adicionar opcao `em_contato` no dropdown "Operacional".
- Icone: `MessageCircle`.

**`EquipeMetrics.tsx`:**
- Adicionar contagem de `em_contato` nas metricas.

**`MapaVistoriasContent.tsx` (mapa do coordenador):**
- No popup dos vistoriadores em campo, substituir o texto fixo "Em servico" pelo status operacional dinamico ("Em Contato com Associado", "Em Rota", "Realizando Tarefa", "Aguardando Atribuicao").
- Isso requer que o hook `useVistoriadoresRealtime` passe a retornar o status operacional (buscando a tarefa ativa do profissional).

### 7. Hook `useVistoriadoresRealtime.ts`

Atualizar para incluir o status operacional de cada vistoriador:
- Buscar a tarefa ativa do profissional (da tabela `servicos`) junto com o campo `contato_realizado_em`.
- Calcular e retornar `status_operacional` seguindo a mesma logica do `useEquipe`.
- Adicionar campo `status_operacional` na interface `VistoriadorLocalizacao`.

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/hooks/useRegistrarContato.ts` | Mutation para registrar contato (whatsapp/ligacao) no servico |
| Migration SQL | Adicionar colunas `contato_realizado_em` e `contato_tipo` em `servicos` |

## Arquivos a Alterar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/migrations/` (nova migration) | Adicionar colunas + atualizar RPC `buscar_tarefa_atual_profissional` |
| `src/hooks/useTarefaAtual.ts` | Mapear novos campos `contato_realizado_em` e `contato_tipo` |
| `src/hooks/useServicos.ts` | Adicionar campos ao tipo `TarefaAtual` / `Servico` |
| `src/components/vistoriador/TarefaAtualCard.tsx` | Botoes de contato registram clique; "Iniciar Percurso" bloqueado ate contato |
| `src/hooks/useEquipe.ts` | Novo status `em_contato`, buscar tarefa de `servicos` (nao `instalacoes`), novos labels |
| `src/components/equipe/EquipeCard.tsx` | Config para `em_contato`, novos labels |
| `src/components/equipe/EquipeFilters.tsx` | Opcao `em_contato` no filtro |
| `src/components/equipe/EquipeMetrics.tsx` | Contagem de `em_contato` |
| `src/hooks/useVistoriadoresRealtime.ts` | Incluir status operacional calculado |
| `src/components/mapa/MapaVistoriasContent.tsx` | Exibir status operacional no popup do vistoriador |
| `src/integrations/supabase/types.ts` | Tipos auto-gerados (atualizados pela migration) |

---

## O que NAO sera alterado

- Edge functions de atribuicao (`atribuir-proxima-tarefa`, `cron-atribuir-tarefas`) -- nao dependem do contato.
- Fluxo de execucao de vistoria/instalacao/manutencao -- esses ja assumem que o profissional chegou.
- `MapaMobileContent.tsx` (mapa do profissional) -- nao mostra status operacional.
- Nenhuma logica de WhatsApp automatizado (Evolution API).
