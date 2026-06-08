# Tempo decorrido + escala de alerta no sininho de Documentos Pendentes

## Objetivo
No popover "Documentos Pendentes" (sininho do header), mostrar há quanto tempo cada proposta está parada e escalar o alerta visual conforme o tempo cresce, para deixar claro que algo está demorando.

## Mudanças

### 1. `src/hooks/usePendenciasDocumentos.ts`
- Incluir `created_at` no `select` de `documentos_solicitados`.
- Adicionar `created_at` em `RawRow` e propagar para cada item de `pendencias` (`{ id, tipo, label, descricao, createdAt }`).
- Calcular e expor `aguardandoDesde` (timestamp da pendência mais antiga do grupo) e `horasParado` em `PendenciaPropostaAgrupada`.
- Ordenar a lista por `aguardandoDesde` ascendente (mais antigos no topo) em vez de por nome — o que está há mais tempo parado vira prioridade.

### 2. `src/components/notificacoes/PendenciasDocumentosBell.tsx`
- Definir função `getNivelAlerta(horas)` com 4 níveis canônicos:
  - `ok` (< 24 h) — neutro (cinza/secondary)
  - `atencao` (24–48 h) — âmbar
  - `alto` (48–96 h) — laranja
  - `critico` (> 96 h) — vermelho (destructive), com badge pulsando
- Em `CardPendencia`:
  - Trocar a borda/fundo do card pela cor do nível (`border-l-4` colorido).
  - Substituir o badge "N pend." pela combinação: badge de tempo (`há 2 d`, `há 5 h`, `há 30 min` via `formatDistanceToNowStrict` do `date-fns` com `locale: ptBR`) + chip "N pend." menor ao lado.
  - Adicionar linha discreta abaixo do nome: "Aguardando desde DD/MM HH:mm".
- No `PopoverTrigger` (badge vermelho no sino), quando houver pelo menos um item em nível `critico` aplicar classe `animate-pulse` para chamar atenção; cor do badge segue o pior nível da fila (destructive já é o default, manter).
- Cabeçalho do popover: adicionar contador resumido "X críticos · Y em atenção" quando houver itens nesses níveis.

## Observações
- Sem mudanças no backend, edge functions, schema ou regras de negócio — apenas UI/derivação no hook.
- `date-fns` e `date-fns/locale` já são usados no projeto; sem novas dependências.
- A ordenação por mais antigo casa com a regra de "cobrar quem está há mais tempo parado".
- Limiares (24/48/96 h) ficam como constantes no topo do componente para ajuste fácil.