

# Investigação Profunda: Hardcoded Remanescente em Planos e Benefícios

## Resumo

Após a migração anterior (LINHAS_PLANO, REGIOES, CATEGORIAS_VEICULO, OBSERVACOES, usePlanosCotacao), ainda existem **9 focos de hardcode** na área de planos e benefícios.

---

## Focos Encontrados

### Foco A — Defaults hardcoded em PlanosConfig.tsx (CRITICO)

**Arquivo**: `src/components/planos/PlanosConfig.tsx` L47-76

O formulário de criação/edição de plano usa defaults fixos em 3 lugares:

```
linha: 'select',
cobertura_fipe: 100,
ano_minimo: 2005,
```

Esses valores deveriam vir da primeira `product_line` ativa do banco, ou de uma configuração default.

---

### Foco B — Cota fallback `|| 6` e `|| 1200` em usePlanosCotacao.ts (CRITICO)

**Arquivo**: `src/hooks/usePlanosCotacao.ts` L219-220

```
const cotaBase = Number(plano.cota_participacao) || 6;
const cotaMinima = Number(plano.cota_minima) || 1200;
```

Esses defaults de negócio (6% e R$1.200) deveriam vir de `configuracoes` (ex: `cota_participacao_default`, `cota_minima_default`).

---

### Foco C — Cota fallback `'6% (mín R$ 1.200,00)'` em CotacaoDetalhe.tsx (CRITICO)

**Arquivo**: `src/pages/vendas/CotacaoDetalhe.tsx` L213, L231

String hardcoded `'6% (mín R$ 1.200,00)'` usada como fallback 2x. Deveria derivar da mesma config.

---

### Foco D — Cota fallback `0.06` e `1200` em StepFinanceiro.tsx (MEDIO)

**Arquivo**: `src/components/substituicao/StepFinanceiro.tsx` L125-131

```
if (!cotasAntigo) return veiculoAntigo.valor_fipe * 0.06;
return Math.max(cotasAntigo.cotas * 200, 1200);
```

Mesmos valores de cota hardcoded no módulo de substituição.

---

### Foco E — MARCAS e MODELOS_POR_MARCA em EtapaDadosVeiculo.tsx (MEDIO)

**Arquivo**: `src/components/cotacao/EtapaDadosVeiculo.tsx` L55-79

17 marcas e ~80 modelos fixos como fallback para entrada manual. A lista não se atualiza sem deploy.

---

### Foco F — COMBUSTIVEIS duplicado em 2 arquivos (BAIXO)

**Arquivos**: `EtapaDadosVeiculo.tsx` L84-90 e `EtapaCriteriosCotacao.tsx` L39-46

Arrays idênticos de combustíveis (gasolina, diesel, flex, elétrico, híbrido) duplicados sem fonte única.

---

### Foco G — Fatores de risco hardcoded em CalculadoraPreco.tsx (MEDIO)

**Arquivo**: `src/components/planos/CalculadoraPreco.tsx` L33-34

```
const FATOR_VEICULO_ANTIGO = 1.15; // +15%
const FATOR_USO_TRABALHO = 1.20;  // +20%
```

E filtro de nível por nome (`basica`, `completa`, `premium`) em L84-88.

---

### Foco H — estimarValorFipe duplicada com ajusteMarca hardcoded (MEDIO)

**Arquivos**: `Cotacao.tsx` L32-41 e `Cotador.tsx` L211-220

Função identica duplicada com fator de depreciação (0.06/ano) e fatores por marca hardcoded.

---

### Foco I — Textos de regra do Deságio em GlossarioSection.tsx (BAIXO)

**Arquivo**: `src/components/planos/GlossarioSection.tsx` L200-203

Texto hardcoded com valores de negócio:
```
"Passeio 6%, Diesel 6%... 8% com mínimo de R$2.000"
```

O componente já usa hooks para glossário, cotas e taxas — mas o alerta usa texto fixo.

---

### Foco J — NIVEL_CONFIG em EscolhaPlano.tsx (BAIXO)

**Arquivo**: `src/components/cotacao-publica/EscolhaPlano.tsx` L35-54

Mapa de cores/ícones para níveis `exclusive`, `premium`, `basic`. Tem fallback funcional para níveis desconhecidos, mas as cores dos 3 principais são fixas. A tabela `planos` já tem `badge_color`.

---

## Plano de Correção

### Fase 1 — Centralizar defaults de cota (Focos B, C, D)

1. Inserir `cota_participacao_default` (6) e `cota_minima_default` (1200) na tabela `configuracoes`
2. Criar hooks `useCotaDefault()` e `useCotaMinimaDefault()` em `useConteudosSistema.ts`
3. Atualizar `usePlanosCotacao.ts`, `CotacaoDetalhe.tsx` e `StepFinanceiro.tsx`

### Fase 2 — Centralizar defaults do form de plano (Foco A)

1. Usar `useProductLines()` para derivar linha default (primeira ativa)
2. Derivar `cobertura_fipe` e `ano_minimo` defaults da config ou da product_line selecionada

### Fase 3 — Unificar COMBUSTIVEIS e estimarValorFipe (Focos F, H)

1. Criar `src/data/combustiveis.ts` com array único exportado
2. Mover `estimarValorFipe` para `src/utils/fipe.ts` — eliminar duplicação entre `Cotacao.tsx` e `Cotador.tsx`

### Fase 4 — Migrar fatores de risco para configuracoes (Foco G)

1. Inserir `fator_veiculo_antigo` (1.15) e `fator_uso_trabalho` (1.20) em `configuracoes`
2. Atualizar `CalculadoraPreco.tsx`

### Fase 5 — Migrar texto do Deságio e NIVEL_CONFIG (Focos I, J)

1. Texto do deságio: derivar dos valores de `useCotasTaxas()` já carregados
2. NIVEL_CONFIG: usar `badge_color` do plano quando disponível

### Fase 6 — MARCAS/MODELOS fallback (Foco E)

Mover para `configuracoes` ou deixar como fallback explícito com comentário — impacto baixo pois FIPE API é a fonte primária.

