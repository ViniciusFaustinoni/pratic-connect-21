

# Sistema Unificado de Regras de Elegibilidade para Coberturas, Beneficios, Planos e Linhas

## Problema

As regras de inclusao/exclusao estao espalhadas e inconsistentes:
- **Planos**: tem fipe_minima/maxima, ano_minimo, categoria (texto), planos_regioes, plano_elegibilidade_modelos
- **Beneficios**: tem benefit_category_exclusions (so por categoria especial)
- **Coberturas**: nao tem nenhuma regra
- **Linhas**: tem blocked_categories e vehicle_type

O usuario quer que TODAS as 8 regras existam em TODOS os 4 niveis, com UI unificada e motor de cotacao que respeite tudo.

## Arquitetura: Tabela Polimorfica `entity_eligibility_rules`

Uma unica tabela que armazena regras para qualquer entidade:

```text
entity_eligibility_rules
├── id UUID PK
├── entity_type TEXT ('linha' | 'plano' | 'cobertura' | 'beneficio')
├── entity_id UUID (FK para a entidade)
├── rule_type TEXT (1 dos 8 tipos abaixo)
├── rule_mode TEXT ('include' | 'exclude') -- inclusiva ou exclusiva
├── rule_config JSONB (parametros da regra)
├── is_active BOOLEAN DEFAULT true
├── created_at / updated_at
```

### Os 8 Tipos de Regra e seu `rule_config`

| rule_type | rule_config exemplo |
|---|---|
| `fipe_range` | `{"min": 0, "max": 120000}` |
| `ano_range` | `{"min": 2005, "max": 2024}` |
| `categoria_veiculo` | `{"categorias": ["passeio","aplicativo","moto"]}` |
| `categoria_especial` | `{"categorias": ["leilao","chassi_remarcado"]}` |
| `regiao` | `{"regioes": ["RJ","SP","LAGOS"]}` |
| `marca_modelo` | `{"marca":"Toyota","modelo":"Corolla","versao":"XEI"}` |
| `tipo_uso` | `{"tipos": ["particular","aplicativo"]}` |
| `combustivel` | `{"combustiveis": ["flex","gasolina","diesel"]}` |

Para `marca_modelo`, o campo `rule_mode` define se e inclusiva (whitelist) ou exclusiva (blacklist).

## Plano de Implementacao

### 1. Migration: criar tabela `entity_eligibility_rules`

```sql
CREATE TABLE entity_eligibility_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('linha','plano','cobertura','beneficio')),
  entity_id UUID NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('fipe_range','ano_range','categoria_veiculo','categoria_especial','regiao','marca_modelo','tipo_uso','combustivel')),
  rule_mode TEXT NOT NULL DEFAULT 'include' CHECK (rule_mode IN ('include','exclude')),
  rule_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_eer_entity ON entity_eligibility_rules(entity_type, entity_id);
CREATE INDEX idx_eer_rule_type ON entity_eligibility_rules(rule_type);
```

RLS: leitura publica, escrita apenas diretores.

### 2. Hook `useEntityEligibilityRules`

Novo hook com:
- `useRulesForEntity(entityType, entityId)` — busca regras de uma entidade
- `useSaveRule` / `useDeleteRule` — mutations
- `useAllEligibilityRules()` — busca todas (para o motor de cotacao)

### 3. Componente Reutilizavel `EligibilityRulesEditor`

Um componente unico que recebe `entityType` e `entityId` e renderiza:
- Lista de regras configuradas com badges visuais
- Botao "Adicionar Regra" que abre dialog com:
  - Select do tipo de regra (8 opcoes)
  - Formulario dinamico baseado no tipo selecionado:
    - **FIPE**: dois inputs numericos (min/max)
    - **Ano**: dois inputs numericos (min/max)
    - **Categoria Veiculo**: checkboxes (dados do CRUD do diretor)
    - **Categoria Especial**: checkboxes (dados do CRUD do diretor)
    - **Regiao**: checkboxes com as regioes do banco
    - **Marca/Modelo**: inputs texto + toggle inclusiva/exclusiva
    - **Tipo de Uso**: checkboxes (dados do CRUD do diretor)
    - **Combustivel**: checkboxes (lista de combustiveis)

### 4. Integrar o Editor nos 4 Formularios

| Formulario | Como integrar |
|---|---|
| `LinhaFormModal.tsx` | Adicionar aba/secao "Regras de Elegibilidade" com `<EligibilityRulesEditor entityType="linha" entityId={id} />` |
| `PlanFormModal.tsx` | Adicionar aba "Regras" no Tabs existente com o editor |
| `CoberturaUnificadaFormModal.tsx` | Expandir modal, adicionar secao de regras |
| `BeneficioFormModal.tsx` | Substituir a secao atual de "Excluir para Categorias Especiais" pelo editor unificado |

### 5. Motor de Cotacao: `usePlanosCotacao.ts`

Modificar o useMemo principal para:
1. Carregar TODAS as regras via `useAllEligibilityRules()`
2. Para cada plano candidato:
   - Verificar regras da **Linha** do plano
   - Verificar regras do **Plano**
   - Para cada cobertura/beneficio vinculado, verificar suas regras proprias
3. Regra cascata: se a Linha bloqueia, o plano inteiro sai. Se a cobertura bloqueia, ela aparece riscada mas o plano continua.
4. Para `marca_modelo` com mode=exclude: o modelo e bloqueado. Com mode=include: so os modelos listados sao aceitos.

A logica existente de elegibilidade (plano_elegibilidade_modelos, benefit_category_exclusions, blocked_categories, etc.) sera gradualmente substituida por esta tabela unificada, mantendo backward compatibility durante a transicao.

### 6. Migracao de Dados Existentes

Migrar dados ja existentes para a nova tabela:
- `plano_elegibilidade_modelos` → regras tipo `marca_modelo` com mode=include
- `benefit_category_exclusions` → regras tipo `categoria_especial` com mode=exclude
- `product_lines.blocked_categories` → regras tipo `categoria_especial` com mode=exclude
- `planos.fipe_minima/fipe_maxima` → regras tipo `fipe_range`
- `planos.ano_minimo` → regras tipo `ano_range`
- `planos.categoria` → regras tipo `categoria_veiculo`
- `planos_regioes` → regras tipo `regiao`

## Arquivos

| Arquivo | Alteracao |
|---|---|
| Nova migration | CREATE TABLE `entity_eligibility_rules` + indices + RLS |
| `src/hooks/useEntityEligibilityRules.ts` | Novo — CRUD de regras |
| `src/components/admin/planos/EligibilityRulesEditor.tsx` | Novo — componente reutilizavel |
| `src/components/admin/planos/LinhaFormModal.tsx` | Integrar editor de regras |
| `src/components/admin/planos/PlanFormModal.tsx` | Integrar editor de regras (nova aba) |
| `src/components/admin/planos/CoberturaUnificadaFormModal.tsx` | Integrar editor de regras |
| `src/components/admin/planos/BeneficioFormModal.tsx` | Substituir exclusoes por editor unificado |
| `src/hooks/usePlanosCotacao.ts` | Carregar e aplicar regras unificadas |

## Ordem de Execucao

1. Migration + hook de dados
2. Componente `EligibilityRulesEditor`
3. Integrar nos 4 formularios
4. Atualizar motor de cotacao
5. Migrar dados existentes (pode ser feito em paralelo)

