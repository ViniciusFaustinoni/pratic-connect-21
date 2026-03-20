

# Plano: Regra "Quase Disponível" por Cruzamento Tempo + Fase (Configurável)

## Situação Atual

- O cron usa apenas **tempo** (75+ min hardcoded) para determinar "quase disponível" e ampliar o raio de 500m para 1km.
- A tabela `servicos` já tem `etapa_atual` (1-5) atualizada em tempo real pelo app do instalador.
- O componente `ConfiguracoesFilaAtribuicao.tsx` já tem 5 campos configuráveis, mas não inclui a etapa mínima.

## O que será feito

Tornar a regra de "quase disponível" um **cruzamento configurável** de tempo E/OU fase, com ambos os parâmetros editáveis pelo coordenador.

### 1. Migration: nova chave de configuração

INSERT na tabela `configuracoes`:
- `fila_etapa_quase_disponivel` → `4` (etapa mínima para considerar quase disponível)
- `fila_tempo_quase_disponivel_min` → `75` (minutos mínimos — hoje está hardcoded)

### 2. `ConfiguracoesFilaAtribuicao.tsx` — 2 campos novos

Adicionar ao array `CONFIG_KEYS`, `FIELDS`, `FilaConfig` e `DEFAULTS`:

- **Tempo mínimo "quase disponível"** (minutos) — min: 30, max: 120, default: 75
- **Etapa mínima "quase disponível"** (número 1-5) — min: 1, max: 5, default: 4, com hint explicando as etapas (1=Dados, 2=Checklist, 3=Fotos, 4=Assinatura, 5=Decisão)

### 3. `cron-atribuir-tarefas/index.ts` — lógica cruzada

Nas linhas 195-199, substituir a regra hardcoded:

**Antes:**
```ts
const raioFila = minutosNaTarefa >= 75 ? raioQuaseDisponivelKm : raioProximidadeKm;
```

**Depois:**
```ts
const etapaAtual = tarefa.etapa_atual || 0;
const quaseDisponivel = minutosNaTarefa >= tempoQuaseDisponivelMin || etapaAtual >= etapaQuaseDisponivel;
const raioFila = quaseDisponivel ? raioQuaseDisponivelKm : raioProximidadeKm;
```

Os valores `tempoQuaseDisponivelMin` e `etapaQuaseDisponivel` são lidos da tabela `configuracoes` no início da execução (junto com os outros 5 parâmetros já existentes), usando o `getConfiguracaoNumero`.

Garantir que a RPC `buscar_tarefa_atual_profissional` retorna `etapa_atual` — se não retorna, adicionar ao SELECT da function.

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL (insert tool) | INSERT 2 chaves: `fila_etapa_quase_disponivel`, `fila_tempo_quase_disponivel_min` |
| `src/components/rotas/ConfiguracoesFilaAtribuicao.tsx` | +2 campos no formulário |
| `supabase/functions/cron-atribuir-tarefas/index.ts` | Ler configs + lógica cruzada tempo OU etapa |

