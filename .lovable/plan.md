
## Diagnóstico

A placa `0KM321B3` mostrada no popup do mapa não é uma placa real — é um **placeholder técnico** gerado automaticamente quando o veículo é 0km (sem placa cadastrada).

### De onde vem

Quando recuperamos a vistoria da Kelly (e em qualquer fluxo de carro 0km), as edges `contrato-gerar` e o script de recovery inserem na tabela `veiculos` uma placa fake no formato `0KM` + 5 caracteres aleatórios, porque a coluna `placa` é NOT NULL/UNIQUE. Esse valor vaza para:

1. `MapaVistoriasContent.tsx` — popup do pin (`v.veiculo_placa || "Sem placa"`), lista lateral, tooltip, modal de confirmação de atribuição, modal de cancelamento, lista de "outras tarefas do técnico".
2. Provavelmente também aparece em outras telas (vistorias, calendário, serviços de campo, sinistros) que leem `veiculo_placa` direto.

A condição `v.veiculo_placa || "Sem placa"` não detecta o placeholder porque ele é uma string válida (`0KM321B3`).

## Correção

### 1) Helper utilitário central
Criar `src/lib/placa-utils.ts` com:
```ts
export const isPlacaPlaceholder = (placa?: string | null) => 
  !!placa && /^0KM[A-Z0-9]{5}$/i.test(placa);

export const formatPlacaExibicao = (placa?: string | null, fallback = '0KM (sem placa)') =>
  !placa || isPlacaPlaceholder(placa) ? fallback : placa.toUpperCase();
```

### 2) Aplicar em `MapaVistoriasContent.tsx`
Trocar todas as ~10 ocorrências de `v.veiculo_placa || "Sem placa"` (e variantes) por `formatPlacaExibicao(v.veiculo_placa)`. Locais:
- Popup do pin de vistoria (linha 721)
- Card lateral da lista (linha 549)
- Toast de atribuição (linha 445)
- Modal de confirmação de atribuição (linhas 1127, 1134)
- Lista "outras tarefas" (linhas 856, 1157)
- Popup de prestador (linhas 906, 925)
- Cancelamento (linha 777 — passar placa formatada para o modal)

Filtro de busca (linha 264) **não muda** — buscar pelo placeholder ainda funciona internamente caso necessário.

### 3) Aplicar em outros pontos críticos (busca rápida)
Aplicar o helper em telas onde a placa é exibida ao usuário final:
- `src/components/vistorias/VistoriaListItem.tsx`
- `src/components/cotacoes/CotacaoCard.tsx` e `CotacaoDetalhesModal.tsx`
- Qualquer outro `veiculo_placa` ou `veiculo?.placa` em componentes de UI (uma busca dirigida vai mostrar — restringir a componentes visuais, não a queries/filtros).

### 4) Badge "0km" opcional
Quando `isPlacaPlaceholder(v.veiculo_placa)` for true, exibir um pequeno badge "0KM" ao lado do fallback no popup e no card, para deixar claro ao operador que é um carro zero — ajuda o vistoriador em campo a saber que vai chegar e o veículo não terá placa ainda.

## Não vou mexer

- Schema do banco (manter o placeholder na coluna `placa` para satisfazer NOT NULL/UNIQUE).
- Edges (`contrato-gerar`, `criar-instalacao-pos-pagamento`) — a geração do placeholder continua igual, só camuflamos na UI.
- Lógica de busca/filtro interna (continua usando o valor real).

## Resultado

No popup da Kelly (e em qualquer carro 0km) o usuário vai ver `0KM (sem placa)` em vez de `0KM321B3`, com badge opcional "0KM". Os dados internos ficam intactos para vínculos, RLS e queries.
