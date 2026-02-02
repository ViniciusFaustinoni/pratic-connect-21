
# Plano: Unificação das Tabelas 'planos' e 'plans'

## Contexto Atual

O sistema possui **duas estruturas paralelas** para gerenciar planos:

### Tabela `planos` (Operacional/Legacy)
- **18 registros** no banco
- **13 tabelas dependentes** com FK:
  - `associados.plano_id`
  - `contratos.plano_id`
  - `cotacoes.plano_id` e `plano_escolhido_id`
  - `leads.plano_escolhido_id`
  - `leads_interesse_planos.plano_id`
  - `tabelas_preco.plano_id`
  - `planos_coberturas.plano_id`
  - `planos_regioes.plano_id`
  - `planos_restricoes.plano_id`
  - `planos_beneficios.plano_id`
  - `rateios_detalhes.plano_id`
- **Usada em**: cotações, contratos, associados, cobranças, cálculo de preços
- **16 arquivos** fazem queries nessa tabela

### Tabela `plans` (Comercial/Vendas)
- **14 registros** no banco
- **1 tabela dependente**: `plan_benefits.plan_id`
- **Usada em**: exibição comercial, catálogo de planos para vendas
- **2 arquivos** fazem queries nessa tabela

### Correspondência Atual
Verificação mostra que **12 de 14 planos** na tabela `plans` têm correspondência por slug com `planos.codigo`:
- `select-basic` ↔ `select-basic` ✅
- `select-premium` ↔ `select-premium` ✅
- `select-exclusive` ↔ `select-exclusive` ✅
- `especial` ↔ `especial` ✅
- etc.

Planos em `planos` **sem correspondência** em `plans`: `BASICO`, `TOTAL`, `PREMIUM`, `ELETRICOS`

## Decisão de Arquitetura

**Manter a tabela `planos` como fonte única de verdade**, pois:
1. Tem mais registros e dados operacionais
2. Possui 13 dependências críticas (associados, contratos, cotações)
3. É usada em todo o sistema operacional
4. A tabela `plans` foi criada posteriormente para exibição comercial

**Estratégia**: Enriquecer `planos` com campos comerciais e criar uma VIEW para compatibilidade com código existente que usa `plans`.

## Estrutura Proposta

### Fase 1: Adicionar Campos Comerciais à Tabela `planos`

```sql
ALTER TABLE planos ADD COLUMN IF NOT EXISTS product_line_id UUID REFERENCES product_lines(id);
ALTER TABLE planos ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
ALTER TABLE planos ADD COLUMN IF NOT EXISTS badge_text VARCHAR(50);
ALTER TABLE planos ADD COLUMN IF NOT EXISTS badge_color VARCHAR(20);
ALTER TABLE planos ADD COLUMN IF NOT EXISTS coverage_type VARCHAR(50);
ALTER TABLE planos ADD COLUMN IF NOT EXISTS restriction_alert TEXT;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS footer_note TEXT;
```

### Fase 2: Migrar Dados de `plans` para `planos`

```sql
-- Atualizar planos existentes com dados comerciais
UPDATE planos p
SET 
  product_line_id = pl.product_line_id,
  slug = pl.slug,
  badge_text = pl.badge_text,
  badge_color = pl.badge_color,
  coverage_type = pl.coverage_type,
  restriction_alert = pl.restriction_alert,
  footer_note = pl.footer_note
FROM plans pl
WHERE LOWER(p.codigo) = LOWER(pl.slug);
```

### Fase 3: Migrar `plan_benefits` para `planos_beneficios`

A tabela `planos_beneficios` já existe. Precisamos:
1. Verificar estrutura atual
2. Migrar dados de `plan_benefits` usando o mapeamento de IDs

```sql
-- Migrar vínculos de benefícios
INSERT INTO planos_beneficios (plano_id, benefit_id, custom_text, custom_value, display_order)
SELECT 
  p.id as plano_id,
  pb.benefit_id,
  pb.custom_text,
  pb.custom_value,
  pb.display_order
FROM plan_benefits pb
JOIN plans pl ON pb.plan_id = pl.id
JOIN planos p ON LOWER(p.codigo) = LOWER(pl.slug)
ON CONFLICT DO NOTHING;
```

### Fase 4: Criar VIEW de Compatibilidade

```sql
CREATE OR REPLACE VIEW vw_plans_compat AS
SELECT 
  p.id,
  p.product_line_id,
  p.nome as name,
  p.codigo as slug,
  p.badge_text,
  p.badge_color,
  p.coverage_type,
  CASE WHEN p.ano_minimo IS NOT NULL 
       THEN '> ' || p.ano_minimo::text 
       ELSE NULL 
  END as min_vehicle_year,
  p.cota_participacao as cota_passeio_percent,
  p.cota_minima as cota_passeio_min,
  p.cota_desagio as cota_desagio_percent,
  p.cota_minima_desagio as cota_desagio_min,
  p.adicional_mensal as additional_price,
  p.restriction_alert,
  p.footer_note,
  p.ordem as display_order,
  p.ativo as is_active,
  p.created_at,
  p.updated_at,
  p.tipo_uso
FROM planos p
WHERE p.ativo = true;
```

### Fase 5: Refatorar Hooks e Componentes

#### Arquivos a Modificar:

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/usePlans.ts` | Alterar queries de `plans` para `planos` + joins |
| `src/hooks/usePlansAdmin.ts` | Alterar CRUD para usar `planos` |
| `src/components/admin/planos/PlanosTab.tsx` | Usar hooks refatorados |
| `src/components/admin/planos/PlanFormModal.tsx` | Ajustar campos do formulário |
| `src/pages/vendas/PlanosBeneficios.tsx` | Usar dados unificados |

## Mapeamento de Campos

| Campo `plans` | Campo `planos` (existente ou novo) |
|---------------|-----------------------------------|
| `id` | `id` |
| `product_line_id` | `product_line_id` (NOVO) |
| `name` | `nome` |
| `slug` | `slug` (NOVO) ou usar `codigo` |
| `badge_text` | `badge_text` (NOVO) |
| `badge_color` | `badge_color` (NOVO) |
| `coverage_type` | `coverage_type` (NOVO) ou inferir de `cobertura_fipe` |
| `min_vehicle_year` | `ano_minimo` (já existe) |
| `cota_passeio_percent` | `cota_participacao` |
| `cota_passeio_min` | `cota_minima` |
| `cota_desagio_percent` | `cota_desagio` |
| `cota_desagio_min` | `cota_minima_desagio` |
| `additional_price` | `adicional_mensal` |
| `restriction_alert` | `restriction_alert` (NOVO) |
| `footer_note` | `footer_note` (NOVO) |
| `display_order` | `ordem` |
| `is_active` | `ativo` |
| `tipo_uso` | `tipo_uso` |

## Fluxo de Migração

```text
┌─────────────────────────────────────────────────────────────────────┐
│                       FASE 1: PREPARAÇÃO                            │
├─────────────────────────────────────────────────────────────────────┤
│  1. Backup das tabelas envolvidas                                   │
│  2. Adicionar colunas comerciais à tabela 'planos'                  │
│  3. Popular product_line_id baseado em linha existente              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       FASE 2: MIGRAÇÃO DE DADOS                     │
├─────────────────────────────────────────────────────────────────────┤
│  1. Copiar dados comerciais de 'plans' → 'planos'                   │
│  2. Migrar 'plan_benefits' → 'planos_beneficios'                    │
│  3. Validar integridade dos dados                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       FASE 3: REFATORAÇÃO DE CÓDIGO                 │
├─────────────────────────────────────────────────────────────────────┤
│  1. Criar hooks unificados                                          │
│  2. Atualizar componentes de admin                                  │
│  3. Atualizar área de vendas                                        │
│  4. Testar fluxos completos                                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       FASE 4: DEPRECAÇÃO                            │
├─────────────────────────────────────────────────────────────────────┤
│  1. Marcar tabela 'plans' como deprecated                           │
│  2. Criar VIEW para retrocompatibilidade                            │
│  3. Remover tabela 'plans' após validação (fase futura)             │
└─────────────────────────────────────────────────────────────────────┘
```

## Hooks Unificados Propostos

### `src/hooks/usePlanosUnificado.ts`

```typescript
// Hook principal que substitui tanto usePlanos quanto usePlans
export function usePlanosUnificado(options?: {
  productLineSlug?: string;
  tipoVeiculo?: 'carro' | 'moto';
  apenasAtivos?: boolean;
}) {
  return useQuery({
    queryKey: ['planos_unificado', options],
    queryFn: async () => {
      let query = supabase
        .from('planos')
        .select(`
          *,
          product_lines (*),
          planos_beneficios (
            *,
            benefits (*)
          )
        `)
        .order('ordem');
      
      if (options?.apenasAtivos !== false) {
        query = query.eq('ativo', true);
      }
      
      if (options?.productLineSlug) {
        query = query.eq('product_lines.slug', options.productLineSlug);
      }
      
      if (options?.tipoVeiculo) {
        query = query.eq('tipo_veiculo', options.tipoVeiculo);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}
```

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Perda de dados na migração | Baixa | Alto | Backup antes da migração + transação única |
| Quebra de FKs existentes | Baixa | Alto | Manter IDs originais da tabela `planos` |
| Inconsistência de dados | Média | Médio | Scripts de validação pós-migração |
| Downtime durante migração | Baixa | Médio | Migração pode ser feita em etapas |

## Resumo de Arquivos a Modificar

### Banco de Dados
1. **Migration**: Adicionar colunas comerciais à `planos`
2. **Migration**: Migrar dados de `plans` e `plan_benefits`
3. **Migration**: Criar VIEW de compatibilidade

### Frontend
1. `src/hooks/usePlans.ts` → Refatorar para usar `planos`
2. `src/hooks/usePlansAdmin.ts` → Refatorar CRUD
3. `src/types/plans.ts` → Unificar tipos
4. `src/components/admin/planos/*.tsx` → Ajustar para nova estrutura
5. `src/pages/vendas/PlanosBeneficios.tsx` → Usar dados unificados

## Dados Preservados

| Origem | Destino | Registros |
|--------|---------|-----------|
| `planos` | `planos` (mantido) | 18 |
| `plans` comerciais | Campos em `planos` | 14 (merge) |
| `plan_benefits` | `planos_beneficios` | 147 |
| `product_lines` | `product_lines` (mantido) | 4 |
| `benefits` | `benefits` (mantido) | 16 |

## Observações Técnicas

1. **Não quebra dependências**: Todas as 13 tabelas que referenciam `planos` continuarão funcionando
2. **Retrocompatibilidade**: VIEW `vw_plans_compat` permite migração gradual
3. **Validação de slug**: Garantir unicidade de `codigo/slug` após merge
4. **RLS**: Manter políticas existentes, adicionar para novos campos
