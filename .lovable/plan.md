

# Plano: Configurações de Atribuição de Tarefas na Aba do Coordenador

## O que existe hoje

- A aba "Configurações" dentro de Rotas (`Rotas.tsx` linha 174) já existe e renderiza o componente `ConfiguracoesEncaixe` com 2 campos: raio de encaixe (km) e janela de disponibilidade (horas).
- As configurações de instalação/rotas (max por dia, horário início, tempo médio, etc.) estão na Diretoria (`InstalacaoRotasConfig.tsx`) — acessível apenas ao diretor.
- Os novos parâmetros da fila inteligente (raio de proximidade 500m, raio "quase disponível" 1km, max itens na fila) estão hardcoded no `cron-atribuir-tarefas`.

## O que será feito

Expandir a aba "Configurações" em Rotas para incluir um segundo card com os parâmetros de atribuição automática de tarefas, acessível ao coordenador.

### 1. Migration: inserir configs na tabela `configuracoes`

Novas chaves com valores padrão:
- `fila_raio_proximidade_metros` → `500` (raio para enfileirar em profissional ocupado)
- `fila_raio_quase_disponivel_metros` → `1000` (raio ampliado quando 75+ min na tarefa)
- `fila_max_por_profissional` → `3` (máx. serviços enfileirados por profissional)
- `fila_tempo_expiracao_horas` → `4` (tempo de expiração de itens na fila)
- `redistribuicao_raio_km` → `5` (raio para redistribuição em caso de imprevisto do instalador)

### 2. Novo componente: `ConfiguracoesFilaAtribuicao.tsx`

Card com os campos editáveis:

- **Raio de proximidade** (metros) — distância para enfileirar serviço em profissional ocupado
- **Raio "quase disponível"** (metros) — raio ampliado quando profissional está terminando
- **Máx. na fila por profissional** — limite de serviços enfileirados
- **Expiração da fila** (horas) — tempo até item expirar
- **Raio de redistribuição** (km) — distância para buscar substituto em imprevisto do instalador
- Botão "Salvar" com upsert na tabela `configuracoes`

Seguir mesmo padrão visual do `ConfiguracoesEncaixe` (Card + tooltips + Input numérico).

### 3. Atualizar `Rotas.tsx`

Na aba "configuracoes" (linha 341), renderizar os dois componentes:
```
<ConfiguracoesEncaixe />
<ConfiguracoesFilaAtribuicao />
```

### 4. Atualizar `cron-atribuir-tarefas` e `cron-reagendamento-automatico`

Substituir os valores hardcoded (500m, 1000m, 5km) por leitura da tabela `configuracoes` no início da execução do cron.

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | INSERT das 5 chaves de config |
| `src/components/rotas/ConfiguracoesFilaAtribuicao.tsx` | Novo componente |
| `src/pages/monitoramento/Rotas.tsx` | Renderizar novo componente na aba |
| `supabase/functions/cron-atribuir-tarefas/index.ts` | Ler configs do banco em vez de hardcoded |
| `supabase/functions/cron-reagendamento-automatico/index.ts` | Ler raio de redistribuição do banco |

