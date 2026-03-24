

# Instalação sem autovistoria: enviar para aprovação do monitoramento

## Problema
Quando o associado escolhe vistoria agendada (não faz autovistoria), ao final da instalação o veículo vai para `status: 'ativo'` imediatamente (linha 1021 de `useServicos.ts`). O correto é que esse veículo apareça na aba **Aprovação de Associados** do Monitoramento para ser aprovado manualmente antes de ativar a Proteção 360.

O filtro atual da Aprovação de Associados (`useAprovacaoMonitoramento.ts`, linha 41) só mostra veículos com `cobertura_roubo_furto = true AND cobertura_total = false`. Veículos sem autovistoria têm `cobertura_roubo_furto = false`, então nunca aparecem na fila.

## Alterações

### 1. `src/hooks/useServicos.ts` — `useAprovarVeiculoServico` (~linha 1016-1031)

Condicionar o status do veículo após instalação:

- **Com autovistoria** (`cobertura_roubo_furto = true`): manter comportamento atual — veículo `ativo`, aguarda monitoramento para `cobertura_total`
- **Sem autovistoria** (`cobertura_roubo_furto = false/null`): veículo vai para `em_analise` em vez de `ativo`

Também ajustar o toast (linha 1138) para diferenciar as mensagens.

### 2. `src/hooks/useAprovacaoMonitoramento.ts` — Ampliar filtro da fila

**`useInstalacoesAguardandoAprovacao`** (linha 39-42): incluir também veículos sem autovistoria. Trocar o filtro de:
```
cobertura_roubo_furto === true && cobertura_total === false
```
Para:
```
cobertura_total === false (ou null)
```
Isso captura ambos os fluxos: com e sem autovistoria.

**`useAprovacaoMonitoramentoStats`** (linha 68-70): aplicar o mesmo filtro ampliado.

### 3. `src/hooks/useAprovacaoMonitoramento.ts` — `useAprovarInstalacaoMonitoramento`

Na aprovação (linha 114-121), além de `cobertura_total = true`, também setar `cobertura_roubo_furto = true` caso ainda esteja false (veículo sem autovistoria prévia).

Se o veículo estava `em_analise`, atualizar para `ativo`.

### Resumo

| Arquivo | Mudança |
|---------|---------|
| `useServicos.ts` | Veículo sem autovistoria → `em_analise` (não `ativo`) |
| `useAprovacaoMonitoramento.ts` | Filtro aceita veículos sem `cobertura_roubo_furto` |
| `useAprovacaoMonitoramento.ts` | Aprovação seta `cobertura_roubo_furto + cobertura_total + veículo ativo` |

3 blocos de alteração em 2 arquivos.

