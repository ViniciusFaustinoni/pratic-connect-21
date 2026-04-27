# Veículos 0KM: exibir chassi no lugar da placa

## Problema

No card "Atribuição Manual" (e demais cards de serviços), veículos 0KM aparecem com a placa-placeholder técnica (ex: `0KM91CD6`) — que não é uma placa real. Usuário precisa ver o **chassi** nesses casos.

Convenção já existente no projeto:
- `src/lib/placa-utils.ts` → `isPlacaPlaceholder()` detecta `0KM + 5 chars`.
- `formatPlacaExibicao()` já existe, mas hoje devolve só `"0KM (sem placa)"` para placeholders, sem usar chassi.

## Plano (3 etapas curtas)

### 1. Novo helper em `src/lib/placa-utils.ts`

Adicionar `formatPlacaOuChassi(placa, chassi, opts?)`:
- Placa real → uppercase.
- Placeholder 0KM com `chassi` → `"0KM · {CHASSI}"` (modo badge) ou `"Chassi {CHASSI}"` (modo full).
- Placeholder sem chassi → fallback `"0KM (sem placa)"`.

### 2. Garantir `chassi` nas queries dos cards

Hooks que alimentam os cards e ainda **não** trazem `chassi` (precisam incluir):

- `src/hooks/useAtribuicaoManual.ts` — linhas 39, 257, 442 (`veiculo:veiculos!...(placa, marca, modelo)` → adicionar `chassi`).
- `src/hooks/useServicos.ts` — linhas 277, 353, 688 (`select` do veículo precisa incluir `chassi`; nas linhas 777 e 799 já vem).

### 3. Trocar a renderização em todos os pontos que mostram placa em card

Lista alvo (apenas os de **card de serviço/instalação/atribuição** — não tocar telas de cadastro/edição de veículo, onde a placa real importa):

- `src/components/monitoramento/AtribuicaoManualTab.tsx` — linhas 80–84 (card pendente) e 166/192 (chip de tarefa atribuída).
- `src/components/servicos-campo/ServicosTable.tsx` — coluna Veículo.
- `src/components/servicos-campo/ServicoDetailModal.tsx` — header.
- `src/components/mapa/MapaVistoriasContent.tsx` — já mostra badge `0KM` (linhas 696, 967); ajustar para também exibir chassi ao lado.
- `src/pages/monitoramento/Instalacoes.tsx` — linha ~240 (badge 0KM).
- `src/components/instalador/*` (tarefa atual / próxima tarefa) — onde placa aparece no app do técnico.

Cada ponto passa a chamar `formatPlacaOuChassi(veiculo?.placa, veiculo?.chassi, { mode: 'badge' })`.

## Comportamento final esperado

- Veículo com placa real `LUJ9I51` → exibe `LUJ9I51` (sem mudança).
- Veículo 0KM `0KM91CD6` com chassi `9BWZZZ377VT004251` → exibe `0KM · 9BWZZZ377VT004251`.
- Veículo 0KM sem chassi cadastrado → exibe `0KM (sem placa)` (fallback atual).

## Riscos

- **Baixo.** Mudança é puramente de exibição. Nenhum filtro/busca por placa é alterado (busca continua aceitando o placeholder).
- Garantir que toda query que renderiza placa em card também `select` o `chassi` (caso contrário, fallback genérico).

## Fora de escopo

- Tela de edição/cadastro de veículo: continua mostrando a placa-placeholder (é o valor real do banco).
- Documentos / contratos / relatórios: já têm tratamento próprio via `Aditivos` "veiculo_0km".

Aprova?