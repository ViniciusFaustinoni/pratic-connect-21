# Adicionar coluna "Crítico" em Relatos de Erros

## Comportamento

- Nada muda no fluxo de quem **cria** um relato — continua entrando como `Aberto`.
- No card `Aberto`, ao abrir o modal de detalhes, surge um botão **"Crítico"**.
- Clicar nele move o relato para o novo status `critico`, que aparece em uma **quarta coluna** na visão de Fila, ao lado de Aberto / Em tratamento / Concluído.
- A coluna "Crítico" funciona como uma "geladeira" — ficam ali para resolver depois.
- Do card `Crítico`, é possível **voltar para Aberto** (re-priorizar) ou **Iniciar tratamento** direto.

## Mudanças técnicas

### Banco
- Adicionar valor `'critico'` ao enum `error_report_status` (migração).

### Backend / tipos
- `src/hooks/useErrorReports.ts`: incluir `'critico'` no tipo `ErrorReportStatus` e tratar na função `useUpdateErrorReportStatus` (toast label).

### UI — `src/pages/diretoria/RelatosErros.tsx`
- `STATUS_LABELS`: adicionar `critico` com cor laranja (chamando atenção sem ser destrutiva).
- `ORDEM_FILA`: passar para `['aberto', 'critico', 'em_tratamento', 'concluido']` (4 colunas).
- Cards de contadores: incluir `critico` (vai para 6 cards no grid responsivo).
- `reportsPorStatus`: incluir `critico` na inicialização.
- Layout do grid de Fila: ajustar `lg:grid-cols-3` → `xl:grid-cols-4` para acomodar 4 colunas (mantendo responsivo).

### UI — `src/components/diretoria/DetalheRelatoModal.tsx`
- `statusBadge`: incluir `critico`.
- Footer: quando `status === 'aberto'`, exibir botão extra **"Marcar como crítico"** (variant outline, ícone `AlertTriangle`, cor laranja) que dispara `update.mutate({ status: 'critico' })`.
- Quando `status === 'critico'`: mostrar dois botões — **"Voltar para aberto"** e **"Iniciar tratamento"**.

## Arquivos afetados

- Migração: novo valor de enum
- `src/hooks/useErrorReports.ts`
- `src/pages/diretoria/RelatosErros.tsx`
- `src/components/diretoria/DetalheRelatoModal.tsx`
