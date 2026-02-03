
# Plano: Corrigir Cálculo do Rateio para Incluir Custos de Ordens de Serviço

## Resumo do Problema

O sistema atual de fechamento mensal (`fechamento-mensal/index.ts`) calcula as despesas do rateio usando **apenas** o campo `sinistro.valor_indenizacao`. Isso ignora os custos de reparos realizados em oficinas, que são registrados nas Ordens de Serviço (`ordens_servico.valor_pago`).

### Cenários de Custo

| Tipo de Sinistro | tipo_dano | Fonte do Valor |
|------------------|-----------|----------------|
| Roubo/Furto não recuperado | `perda_total` | `sinistro.valor_indenizacao` |
| Colisão com perda total (≥75% FIPE) | `perda_total` | `sinistro.valor_indenizacao` |
| Colisão com dano parcial (<75% FIPE) | `parcial` | `ordens_servico.valor_pago` |
| Roubo recuperado com danos | `parcial` | `ordens_servico.valor_pago` |
| Fenômeno natural/Vandalismo | varia | Depende de `tipo_dano` |

---

## Arquitetura da Solução

```text
┌────────────────────────────────────────────────────────────────────┐
│                    FECHAMENTO MENSAL                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  1. Buscar SINISTROS do período                                    │
│     └── Status: aprovado, indenizado, pago                         │
│                                                                    │
│  2. Para cada sinistro, calcular valor do custo:                   │
│                                                                    │
│     ┌─────────────────────────────────────────────────────────┐    │
│     │  SE tipo_dano = 'perda_total'                           │    │
│     │  └── valor = sinistro.valor_indenizacao                 │    │
│     │                                                         │    │
│     │  SE tipo_dano = 'parcial' (reparo)                      │    │
│     │  └── valor = SUM(ordens_servico.valor_pago)             │    │
│     │        WHERE sinistro_id = sinistro.id                  │    │
│     │        AND status IN ('concluido', 'pago')              │    │
│     │                                                         │    │
│     │  FALLBACK (tipo_dano NULL ou indefinido)                │    │
│     │  └── valor = sinistro.valor_indenizacao                 │    │
│     │      OU SUM(OS.valor_pago) se existir                   │    │
│     └─────────────────────────────────────────────────────────┘    │
│                                                                    │
│  3. Agrupar despesas por benefício                                 │
│                                                                    │
│  4. Inserir em despesas_rateio                                     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Alterações Técnicas

### 1. Modificar Edge Function `fechamento-mensal/index.ts`

**Localização:** `supabase/functions/fechamento-mensal/index.ts`

**Alterações:**

#### 1.1 Expandir Query de Sinistros (linhas 102-108)

Adicionar campo `tipo_dano` na seleção e buscar OS vinculadas:

```typescript
// ANTES
const { data: sinistros } = await supabase
  .from('sinistros')
  .select('id, tipo, valor_indenizacao, data_ocorrencia, associado_id, veiculo_id')
  .in('status', ['aprovado', 'indenizado', 'pago'])
  .gte('data_ocorrencia', inicioMes)
  .lte('data_ocorrencia', fimMes);

// DEPOIS
const { data: sinistros } = await supabase
  .from('sinistros')
  .select(`
    id, 
    tipo, 
    tipo_dano,
    valor_indenizacao, 
    data_ocorrencia, 
    associado_id, 
    veiculo_id
  `)
  .in('status', ['aprovado', 'indenizado', 'pago'])
  .gte('data_ocorrencia', inicioMes)
  .lte('data_ocorrencia', fimMes);
```

#### 1.2 Buscar OS Pagas do Período

Adicionar nova query para buscar Ordens de Serviço pagas/concluídas:

```typescript
// Buscar OS pagas vinculadas a sinistros do período
const sinistrosIds = (sinistros || []).map(s => s.id);

const { data: ordensServico } = await supabase
  .from('ordens_servico')
  .select('id, sinistro_id, valor_pago, status')
  .in('sinistro_id', sinistrosIds)
  .in('status', ['concluido', 'pago', 'aguardando_pagamento']);

// Criar mapa de valor pago por sinistro
const valorPagoPorSinistro: Record<string, number> = {};
for (const os of (ordensServico || [])) {
  if (os.sinistro_id && os.valor_pago) {
    valorPagoPorSinistro[os.sinistro_id] = 
      (valorPagoPorSinistro[os.sinistro_id] || 0) + os.valor_pago;
  }
}
```

#### 1.3 Modificar Lógica de Cálculo de Despesas (linhas 123-130)

Usar valor apropriado baseado no tipo_dano:

```typescript
// ANTES
for (const sinistro of (sinistros || [])) {
  const beneficio = SINISTRO_PARA_BENEFICIO[sinistro.tipo];
  if (beneficio && despesasPorBeneficio[beneficio]) {
    despesasPorBeneficio[beneficio].valor += sinistro.valor_indenizacao || 0;
    // ...
  }
}

// DEPOIS
for (const sinistro of (sinistros || [])) {
  const beneficio = SINISTRO_PARA_BENEFICIO[sinistro.tipo];
  if (beneficio && despesasPorBeneficio[beneficio]) {
    // Determinar valor do custo baseado no tipo de dano
    let valorCusto = 0;
    
    if (sinistro.tipo_dano === 'perda_total') {
      // Perda total: usar valor de indenização
      valorCusto = sinistro.valor_indenizacao || 0;
    } else if (sinistro.tipo_dano === 'parcial') {
      // Dano parcial: priorizar valor pago das OS
      valorCusto = valorPagoPorSinistro[sinistro.id] || sinistro.valor_indenizacao || 0;
    } else {
      // Fallback: verificar se há OS paga, senão usar valor_indenizacao
      valorCusto = valorPagoPorSinistro[sinistro.id] || sinistro.valor_indenizacao || 0;
    }
    
    despesasPorBeneficio[beneficio].valor += valorCusto;
    despesasPorBeneficio[beneficio].quantidade += 1;
    despesasPorBeneficio[beneficio].sinistros_ids.push(sinistro.id);
  }
}
```

---

### 2. Adicionar Logging Detalhado

Para auditoria e debug:

```typescript
console.log(`[fechamento-mensal] Sinistro ${sinistro.id}: tipo=${sinistro.tipo}, tipo_dano=${sinistro.tipo_dano}, valor_indenizacao=${sinistro.valor_indenizacao}, valor_os=${valorPagoPorSinistro[sinistro.id] || 0}, valor_usado=${valorCusto}`);
```

---

### 3. Atualizar Resumo da Resposta

Incluir detalhamento de fontes de custo:

```typescript
resumo: {
  // campos existentes...
  custos_detalhados: {
    indenizacoes: totalIndenizacoes,
    reparos_oficina: totalReparos,
    total: totalDespesasRateio,
  }
}
```

---

## Interface para Incluir Custos de OS na Tabela `despesas_rateio`

Considerar adicionar campos para rastreabilidade:

```sql
-- Opcional: adicionar coluna para guardar IDs das OS incluídas
ALTER TABLE despesas_rateio 
ADD COLUMN IF NOT EXISTS ordens_servico_ids UUID[] DEFAULT '{}';
```

---

## Resumo das Alterações

| Arquivo | Linha(s) | Alteração |
|---------|----------|-----------|
| `fechamento-mensal/index.ts` | 102-108 | Adicionar `tipo_dano` na query |
| `fechamento-mensal/index.ts` | 109+ | Nova query para buscar OS pagas |
| `fechamento-mensal/index.ts` | 123-130 | Lógica condicional para determinar valor do custo |
| `fechamento-mensal/index.ts` | 227-238 | Adicionar detalhamento no resumo |

---

## Fluxo de Decisão do Valor

```text
                    SINISTRO
                        │
                        ▼
              ┌─────────────────┐
              │   tipo_dano?    │
              └────────┬────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
  'perda_total'    'parcial'     NULL/undefined
        │              │              │
        ▼              ▼              ▼
┌───────────────┐ ┌──────────────┐ ┌──────────────┐
│ valor =       │ │ Buscar OS    │ │ Verificar se │
│ valor_        │ │ vinculadas   │ │ existe OS    │
│ indenizacao   │ │ ao sinistro  │ │ vinculada    │
└───────────────┘ └──────┬───────┘ └──────┬───────┘
                         │                │
                         ▼                ▼
                  ┌─────────────┐  ┌─────────────┐
                  │ valor =     │  │ Sim: usar   │
                  │ SUM(OS.     │  │ OS.valor_   │
                  │ valor_pago) │  │ pago        │
                  └─────────────┘  │ Não: usar   │
                                   │ valor_      │
                                   │ indenizacao │
                                   └─────────────┘
```

---

## Validação

Após implementação:

1. Criar um sinistro de teste com `tipo_dano = 'parcial'`
2. Vincular uma OS paga a esse sinistro
3. Executar fechamento mensal
4. Verificar se o valor da OS aparece nas despesas do rateio
5. Comparar com comportamento anterior (deveria usar valor_indenizacao)
