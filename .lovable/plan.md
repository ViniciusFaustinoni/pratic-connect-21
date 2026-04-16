
## Diagnóstico

A autovistoria pública (etapa 4 do fluxo de cotação para Yamaha NMAX 160 — moto) está pedindo fotos de **carro** (frente, traseira, laterais, motor, painel, etc.) em vez do conjunto correto de **moto** (frente, traseira, laterais, painel, chassi, motor, hodômetro).

### Investigação necessária

Preciso confirmar (na próxima rodada com permissão de leitura):

1. **Componente da autovistoria pública** — provável `src/pages/cotacao/Autovistoria*.tsx` ou similar dentro do fluxo `/cotacao/:token`.
2. **Definição dos slots de fotos** — onde está hardcoded a lista (`frente`, `traseira`, `lateral_esquerda`, etc.). Suspeita: array fixo sem branch por categoria do veículo.
3. **Fonte da categoria do veículo no contexto público** — se o token de cotação carrega `tipo_veiculo` / `categoria` / `tipoPlaca` (memória `vehicle-context-plate-type-sync-v2` diz que `tipoPlaca` é a fonte de verdade).
4. **Comparar com o app do regulador/instalador** — `VistoriaEventoMidias.tsx` e `ExecutarVistoriaCompleta.tsx` já tratam moto vs carro? Se sim, reaproveitar a mesma lista.

### Causa provável

O componente da autovistoria pública usa um array fixo de slots de carro, sem ler `categoria === 'moto'` do contexto da cotação para alternar para o conjunto de moto.

## Correção planejada

### 1. Identificar a categoria no fluxo público
- Ler `categoria` / `tipoPlaca` do payload da cotação (`cotacoes.dados_veiculo` ou `marcas_modelos.categoria`) já presente no contexto da página pública.

### 2. Definir conjuntos de fotos por categoria
Centralizar em `src/lib/vistoria/slotsFotos.ts` (novo):

```ts
export const SLOTS_CARRO = [
  'frente', 'traseira', 'lateral_esquerda', 'lateral_direita',
  'painel', 'hodometro', 'motor', 'chassi', 'pneus', 'documento'
];

export const SLOTS_MOTO = [
  'frente', 'traseira', 'lateral_esquerda', 'lateral_direita',
  'painel_hodometro', 'chassi', 'motor', 'documento'
];

export function getSlotsFotos(categoria: 'carro' | 'moto') {
  return categoria === 'moto' ? SLOTS_MOTO : SLOTS_CARRO;
}
```

### 3. Refatorar componentes que listam slots
- Componente da autovistoria pública (a confirmar nome): trocar array fixo pela função.
- `VistoriaEventoMidias.tsx` e equivalente do instalador: usar a mesma função para garantir paridade (memória `inspection-workflow-parity`).
- Vídeo 360º: igual para os dois.

### 4. Labels amigáveis
Mapa `LABELS_SLOT` com nomes em PT-BR já adaptados ("Painel/Hodômetro" para moto vs "Painel" + "Hodômetro" separados para carro).

### 5. Validação
- Abrir cotação de moto (NMAX): deve listar 8 slots de moto.
- Abrir cotação de carro: deve listar 10 slots de carro.
- Conferir nas três entradas: público (autovistoria), regulador, instalador.

## Arquivos a editar (estimado)
- **Novo**: `src/lib/vistoria/slotsFotos.ts`
- Componente público da autovistoria (a localizar — provável `src/pages/cotacao/VistoriaPublicaPage.tsx` ou `AutovistoriaPublicaPage.tsx`)
- `src/components/regulador/VistoriaEventoMidias.tsx` (ajustar para usar helper)
- Equivalente do instalador, se houver duplicação

## Não vou mexer
- Lógica de upload offline (já implementada na rodada anterior — só consome a lista de slots).
- Edge functions de salvamento (aceitam qualquer slot).
- Cálculo de preço/cotação.

## Resultado esperado
Cotação de moto na etapa de autovistoria mostra apenas as fotos pertinentes a moto (sem "motor frontal", "porta-malas" etc.), idêntico ao que o vistoriador presencial vê. Carros continuam com o conjunto completo. Zero impacto no resto do fluxo.
