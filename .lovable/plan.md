

# Plano: CRUD Completo de Coberturas e Benefícios na Gestão Comercial

## Diagnóstico

O sistema já possui os seguintes componentes CRUD prontos, mas espalhados ou não integrados na página de Gestão Comercial (`/diretoria/gestao-comercial`):

**Já existe (hooks):**
- `usePlansAdmin.ts`: CRUD completo para `benefits`, `main_coverages`, `product_lines`, `planos`, `planos_beneficios`
- `VincularCoberturaModal` e `EditarCoberturaVinculadaModal`: modais para vincular/editar coberturas de sinistro por plano (tabela `planos_coberturas`)
- `BeneficioFormModal` (admin): criar/editar benefícios na tabela `benefits`
- `CoberturaFormModal` (admin): criar/editar coberturas na tabela `main_coverages`
- `ProdutoFormModal`: criar/editar planos

**O que falta na interface de Gestão Comercial:**

1. **Aba Benefícios & Coberturas** (`BeneficiosCoberturas.tsx`):
   - Sem botão "Novo Benefício" / "Editar" benefício
   - Sem botão "Nova Cobertura" / "Editar" cobertura (main_coverages)
   - Sem modal para vincular/desvincular benefícios de um plano
   - Delete existe mas sem confirmação

2. **Aba Produtos & Planos** (`ProdutosPlanos.tsx`):
   - Sub-aba "Coberturas" é read-only (sem vincular, editar ou remover coberturas do plano)
   - Sub-aba "Detalhes" mostra benefícios como badges mas sem CRUD inline
   - Sem aba de "Benefícios" no painel de detalhe do plano

## Implementação

### 1. Adicionar CRUD de Benefícios na aba `BeneficiosCoberturas.tsx`
- Importar `BeneficioFormModal` de `@/components/admin/planos/BeneficioFormModal`
- Botão "Novo Benefício" no header da coluna de benefícios
- Botão de editar (ícone lápis) em cada card de benefício
- Envolver delete em `AlertDialog` de confirmação
- Importar `CoberturaFormModal` de `@/components/admin/planos/CoberturaFormModal`
- Botão "Nova Cobertura" e editar/delete com confirmação na coluna de coberturas

### 2. Adicionar CRUD de Coberturas por Plano no detalhe do plano (`ProdutosPlanos.tsx`)
- Importar `VincularCoberturaModal` e `EditarCoberturaVinculadaModal` de `@/components/diretoria`
- Na sub-aba "Coberturas": botão "Vincular Cobertura", botões editar/remover por cobertura
- Buscar dados completos de `planos_coberturas` (incluindo `percentual_cobertura`, `franquia_valor`, `carencia_dias`, `obrigatoria`) no query
- Adicionar mutation para desvincular cobertura (`DELETE` de `planos_coberturas`)

### 3. Adicionar sub-aba "Benefícios" no painel de detalhe do plano
- Nova sub-aba entre "Coberturas" e "Detalhes"
- Lista os benefícios vinculados ao plano (via `planos_beneficios`)
- Botão "Vincular Benefício" abre modal para selecionar de `benefits` e inserir em `planos_beneficios`
- Botões editar (custom_text, is_highlighted) e remover por benefício

### 4. Criar `VincularBeneficioModal.tsx` (novo componente)
- Similar ao `VincularCoberturaModal`: lista benefícios disponíveis (não vinculados), permite selecionar e configurar `custom_text`, `custom_value`, `is_highlighted`
- Insere em `planos_beneficios`

## Arquivos a criar
- `src/components/gestao-comercial/VincularBeneficioModal.tsx`

## Arquivos a modificar
- `src/components/gestao-comercial/BeneficiosCoberturas.tsx` — adicionar botões criar/editar + modais + confirmação de delete
- `src/components/gestao-comercial/ProdutosPlanos.tsx` — sub-aba coberturas com CRUD + nova sub-aba benefícios + vincular modal

## Observações técnicas
- Todos os hooks de mutation já existem em `usePlansAdmin.ts`
- Os modais de cobertura de sinistro (`VincularCoberturaModal`, `EditarCoberturaVinculadaModal`) já estão prontos em `src/components/diretoria/`
- O modal de benefício (`BeneficioFormModal`) já existe em `src/components/admin/planos/`
- Nenhuma alteração de banco de dados necessária

