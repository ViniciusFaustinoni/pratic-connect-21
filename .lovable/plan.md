## Diagnóstico

Verifiquei a placa **KRN6G76** no banco:

| Campo | Valor |
|---|---|
| `veiculos.status` | `instalacao_pendente` |
| `cobertura_suspensa` | **true** |
| `cobertura_suspensa_em` | 10/05/2026 18:07 |
| `cobertura_suspensa_motivo` | "Instalação não realizada no prazo de 48h após assinatura" |
| `contratos.data_assinatura` | 08/05/2026 17:11 |

A suspensão automática **funcionou corretamente** no backend (cron + trigger marcaram `cobertura_suspensa=true` ~48h após a assinatura). O problema é puramente de **apresentação na lista de Veículos**:

- A lista (`src/pages/cadastro/Veiculos.tsx` + `src/hooks/useVeiculos.ts`) hoje só lê `veiculos.status`. Como o campo `status` continua `instalacao_pendente` (estado de fluxo, conforme arquitetura — suspensão é um flag separado de cobertura, não substitui o status do veículo), o badge cai no fallback "Aguardando Vistoria/Aprovação".
- O selo `Suspenso` (laranja) já existe no mapa de cores (`statusColors.suspenso`), mas nunca é renderizado para casos de suspensão por não-instalação, porque a UI nunca consulta `cobertura_suspensa`.

## O que vou alterar (apenas UI)

1. **`src/hooks/useVeiculos.ts`** — adicionar `cobertura_suspensa, cobertura_suspensa_em, cobertura_suspensa_motivo` ao `select` do `useVeiculos` e do `useVeiculosPaginados`.
2. **`src/pages/cadastro/Veiculos.tsx`** (componente `VeiculoRow` + render da tabela paginada na linha ~442):
   - Se `veiculo.cobertura_suspensa === true`, o badge passa a renderizar **"Suspenso"** com a cor `statusColors.suspenso` (laranja), sobrepondo o fallback atual de "Aguardando Vistoria/Aprovação".
   - Tooltip no badge mostrando o motivo (`cobertura_suspensa_motivo`) e a data (`cobertura_suspensa_em`) para o operador entender por que está suspenso sem precisar abrir o detalhe.
   - Ordem de prioridade do label: `suspenso` (flag) → `instalacao_pendente sem instalação` → status cru.
3. **Filtro de status** no topo da listagem: incluir a opção "Suspenso" que filtra por `cobertura_suspensa=true` (independente de `veiculos.status`), para que a equipe consiga isolar a fila.

Sem mudanças em backend, triggers, ou no campo `veiculos.status` — respeitando a arquitetura atual (suspensão é flag de cobertura, não estado de ciclo de vida).

## Resultado esperado

A linha do KRN6G76 passa a mostrar o badge **"Suspenso"** (laranja) com tooltip "Instalação não realizada no prazo de 48h após assinatura — desde 10/05/2026", e fica filtrável pelo seletor de status.