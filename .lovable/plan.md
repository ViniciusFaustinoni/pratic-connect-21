
# Análise do Sistema de Rateio: Problemas e Correções

## Resumo Executivo

Após análise detalhada do código, identifiquei **6 problemas críticos** no sistema de cálculo de rateio que comprometem a precisão das cobranças e a correta distribuição de custos por tipo de benefício.

---

## Arquitetura Atual vs. Esperada

O sistema possui **duas implementações paralelas** de rateio que não estão integradas:

| Componente | Página | Status |
|------------|--------|--------|
| `RateioSinistros.tsx` | `/diretoria/rateios` | ⚠️ Implementação ANTIGA (usa tabela `rateios`) |
| `FechamentoMensal.tsx` | `/diretoria/fechamento` | ✅ Implementação NOVA (usa tabela `fechamentos_mensais`) |

### Problema Principal
As duas implementações usam **lógicas diferentes** e **tabelas diferentes**, causando duplicação e inconsistência.

---

## Problemas Identificados

### 1. Mapeamento Incompleto de Tipos de Sinistro

**Arquivo:** `supabase/functions/fechamento-mensal/index.ts` (linhas 22-33)

**Mapeamento atual:**
```typescript
const SINISTRO_PARA_BENEFICIO = {
  'colisao_parcial': 'colisao',
  'colisao_total': 'colisao',
  'colisao': 'colisao',
  'roubo': 'roubo_furto',
  'furto': 'roubo_furto',
  'roubo_furto': 'roubo_furto',
  'incendio': 'incendio',
  'vidros': 'vidros',
  'terceiros': 'terceiros',
};
```

**Tipos faltando no mapeamento:**
- `fenomeno_natural` → deveria mapear para `colisao` ou categoria própria
- `vandalismo` → deveria mapear para `colisao`
- `outro` → sem mapeamento definido

**Impacto:** Sinistros desses tipos são **ignorados** no cálculo do rateio.

---

### 2. Campo `quantidade_cotas` Não Preenchido nos Veículos

**Query no banco:**
```sql
SELECT quantidade_cotas, faixa_cota_id FROM veiculos WHERE status = 'ativo'
```

**Resultado:** `quantidade_cotas: null, faixa_cota_id: null`

**Problema:** A tabela `veiculos` não está sendo atualizada com a quantidade de cotas ao cadastrar ou atualizar veículos. O sistema depende de:
1. `veiculo.quantidade_cotas` (campo direto - **NULL**)
2. `veiculo.faixas_cotas.quantidade_cotas` (join com tabela de faixas - **NULL porque faixa_cota_id é NULL**)
3. Fallback: `Math.ceil(valorFipe / 5000)` (cálculo manual)

**Impacto:** Todos os veículos estão usando o fallback, perdendo os ajustes por faixa.

---

### 3. Função SQL usa Tabela Errada para Cotas

**Arquivo:** Função `fn_calcular_total_cotas_ativos`

```sql
SELECT COALESCE(SUM(fn_get_cotas_por_fipe(COALESCE(c.veiculo_valor_fipe, 0))), 0)
FROM contratos c
WHERE c.status = 'ativo';
```

**Problema:** 
- Busca o valor FIPE da tabela `contratos` (`c.veiculo_valor_fipe`)
- Não considera a tabela `veiculos` que tem dados mais atualizados
- Nem todos os contratos têm `veiculo_valor_fipe` preenchido

**Impacto:** Total de cotas pode estar **incorreto ou zerado**.

---

### 4. Cálculo de Rateio Não Usa Cobertura Específica

**Arquivo:** `supabase/functions/calcular-rateio-completo/index.ts` (linhas 125-131)

```typescript
// Todos esses benefícios verificam apenas cobertura_total
if (tipoBeneficio === 'colisao' || tipoBeneficio === 'incendio' || 
    tipoBeneficio === 'vidros' || tipoBeneficio === 'terceiros') {
  query = query.eq('cobertura_total', true);
}
```

**Problema:** 
- `vidros` e `terceiros` são **coberturas adicionais** opcionais, não fazem parte de `cobertura_total`
- Deveria haver campos específicos como `cobertura_vidros`, `cobertura_terceiros`
- Sistema assume que quem tem `cobertura_total` tem todos os benefícios

**Impacto:** Associados sem vidros/terceiros podem estar pagando rateio dessas coberturas.

---

### 5. Assistência Não Tem Filtro de Cobertura

**Arquivo:** `supabase/functions/gerar-faturas-mensais/index.ts` (linha 215)

```typescript
rateio_assistencia: (valorPorCotaBeneficio['assistencia'] || 0) * cotas,
```

**Problema:** Não há verificação se o associado tem cobertura de assistência 24h.

**Impacto:** Todos os associados pagam rateio de assistência, mesmo quem não contratou.

---

### 6. Duplicação de Lógica entre Páginas

**Arquivos:**
- `RateioSinistros.tsx` - Usa tabela `rateios` e `rateios_detalhes_faixas`
- `FechamentoMensal.tsx` - Usa tabela `fechamentos_mensais` e `despesas_rateio`

**Problema:** Duas páginas calculam rateio de formas diferentes, gerando confusão.

---

## Plano de Correções

### Fase 1: Correções no Mapeamento de Tipos

**Arquivo:** `supabase/functions/fechamento-mensal/index.ts`

1. Adicionar tipos faltantes ao mapeamento:
```typescript
const SINISTRO_PARA_BENEFICIO = {
  // Existentes...
  'fenomeno_natural': 'colisao', // Granizo, alagamento → Colisão
  'vandalismo': 'colisao',       // Vandalismo → Colisão
  'outro': 'colisao',            // Outros → Colisão (ou ignorar)
};
```

---

### Fase 2: Popular Campo `quantidade_cotas` nos Veículos

**Criar migration SQL:**

```sql
-- Atualizar veículos existentes com quantidade de cotas
UPDATE veiculos v
SET 
  quantidade_cotas = fc.quantidade_cotas,
  faixa_cota_id = fc.id
FROM faixas_cotas fc
WHERE v.valor_fipe >= fc.fipe_de 
  AND v.valor_fipe <= fc.fipe_ate
  AND fc.ativo = true
  AND v.quantidade_cotas IS NULL;

-- Criar trigger para atualizar automaticamente
CREATE OR REPLACE FUNCTION fn_atualizar_cotas_veiculo()
RETURNS TRIGGER AS $$
BEGIN
  SELECT id, quantidade_cotas 
  INTO NEW.faixa_cota_id, NEW.quantidade_cotas
  FROM faixas_cotas
  WHERE NEW.valor_fipe >= fipe_de 
    AND NEW.valor_fipe <= fipe_ate
    AND ativo = true
  LIMIT 1;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_veiculos_atualizar_cotas
  BEFORE INSERT OR UPDATE OF valor_fipe ON veiculos
  FOR EACH ROW
  EXECUTE FUNCTION fn_atualizar_cotas_veiculo();
```

---

### Fase 3: Corrigir Função SQL

**Alterar `fn_calcular_total_cotas_ativos`:**

```sql
CREATE OR REPLACE FUNCTION fn_calcular_total_cotas_ativos()
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  -- Priorizar campo quantidade_cotas preenchido
  SELECT COALESCE(SUM(
    COALESCE(
      v.quantidade_cotas,
      fc.quantidade_cotas,
      CEIL(COALESCE(v.valor_fipe, 50000) / 5000)
    )
  ), 0)
  INTO v_total
  FROM veiculos v
  LEFT JOIN faixas_cotas fc ON v.faixa_cota_id = fc.id
  WHERE v.status = 'ativo';
  
  RETURN v_total;
END;
$$;
```

---

### Fase 4: Adicionar Campos de Cobertura Específica

**Criar migration para veículos:**

```sql
ALTER TABLE veiculos
ADD COLUMN IF NOT EXISTS cobertura_vidros BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cobertura_terceiros BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cobertura_assistencia BOOLEAN DEFAULT true;
```

**Atualizar edge function `calcular-rateio-completo`:**

```typescript
// Filtros específicos por benefício
if (tipoBeneficio === 'colisao') {
  query = query.eq('cobertura_total', true);
} else if (tipoBeneficio === 'roubo_furto') {
  query = query.or('cobertura_roubo_furto.eq.true,cobertura_total.eq.true');
} else if (tipoBeneficio === 'vidros') {
  query = query.eq('cobertura_vidros', true);
} else if (tipoBeneficio === 'terceiros') {
  query = query.eq('cobertura_terceiros', true);
} else if (tipoBeneficio === 'assistencia') {
  query = query.eq('cobertura_assistencia', true);
}
```

---

### Fase 5: Unificar Páginas de Rateio

**Opção recomendada:** Manter apenas `FechamentoMensal.tsx` como página principal e:
- Remover ou deprecar `RateioSinistros.tsx`
- Ou transformar `RateioSinistros.tsx` em visualização histórica apenas

---

## Resumo de Arquivos a Modificar

| Arquivo | Ação | Prioridade |
|---------|------|------------|
| Migration SQL nova | Criar trigger para cotas e popular dados | 🔴 Alta |
| `fechamento-mensal/index.ts` | Adicionar tipos faltantes ao mapeamento | 🔴 Alta |
| `fn_calcular_total_cotas_ativos` (SQL) | Corrigir query para usar tabela veiculos | 🔴 Alta |
| `calcular-rateio-completo/index.ts` | Adicionar filtros específicos por cobertura | 🟡 Média |
| `gerar-faturas-mensais/index.ts` | Verificar cobertura antes de cobrar | 🟡 Média |
| Migration SQL para coberturas | Adicionar campos `cobertura_vidros`, etc. | 🟡 Média |
| `RateioSinistros.tsx` | Deprecar ou integrar com FechamentoMensal | 🟢 Baixa |

---

## Verificação Adicional Necessária

Antes de implementar, é importante verificar:

1. **Como os planos definem coberturas?** 
   - Os campos `cobertura_total`, `cobertura_roubo_furto` vêm do plano ou do veículo?
   - Existe tabela de benefícios por plano que deve ser consultada?

2. **Qual página deve ser a oficial?**
   - `/diretoria/rateios` (antiga, tabela `rateios`)
   - `/diretoria/fechamento` (nova, tabela `fechamentos_mensais`)

3. **Os dados de sinistros estão corretos?**
   - Existem sinistros aprovados/indenizados no período atual para testar?
