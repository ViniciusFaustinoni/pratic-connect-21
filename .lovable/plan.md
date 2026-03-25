

# Consolidar Coberturas & Beneficios na Gestao Comercial

## Contexto

Hoje existem tres tabelas separadas:
- `benefits` — beneficios de marketing (vinculados a planos via `planos_beneficios`)
- `main_coverages` — coberturas visuais (globais, sem vinculo a planos, usadas apenas em vitrine)
- `coberturas` — coberturas tecnicas de sinistro (vinculadas via `planos_coberturas`, com franquias, limites, carencias)

O pedido e eliminar `main_coverages` e fazer tudo que era visual passar a ler de `coberturas` (a tabela tecnica). A pagina passa a ter duas abas: Coberturas (da tabela `coberturas`) e Beneficios (da tabela `benefits`).

## Plano

### 1. Adicionar campos visuais a tabela `coberturas`
Migracão SQL para adicionar colunas que hoje so existem em `main_coverages`:
```sql
ALTER TABLE coberturas ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE coberturas ADD COLUMN IF NOT EXISTS subtitle text;
ALTER TABLE coberturas ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
```
Migrar dados existentes de `main_coverages` para `coberturas` (inserir registros que nao existam, mapeando `name`→`nome`, `subtitle`→`subtitle`, `icon`→`icon`).

### 2. Renomear menu
Em `TabNavigation.tsx`, alterar o item de "Beneficios & Coberturas" / "Beneficios" para "Coberturas & Beneficios" / "Cob. & Benef.".

Em `GestaoComercial.tsx`, atualizar o `sectionBanners` correspondente.

### 3. Reescrever `BeneficiosCoberturas.tsx`
Substituir o layout de duas colunas por duas abas (usando `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`):

**Aba Coberturas**: lista de `coberturas` (tabela tecnica) com nome, descricao, icone, status ativo/inativo. CRUD via modal (novo `CoberturaUnificadaFormModal` ou adaptar o existente para ler/escrever em `coberturas` em vez de `main_coverages`).

**Aba Beneficios**: lista de `benefits` com nome, descricao, icone, status. CRUD via modal existente (`BeneficioFormModal`). Manter filtro por plano, badges de planos vinculados.

### 4. Criar hooks para coberturas tecnicas na gestao
- `useCoberturas()` — query na tabela `coberturas` (todas, sem filtro de ativo, para gestao)
- `useCreateCobertura()`, `useUpdateCobertura()`, `useDeleteCobertura()` — mutations CRUD

### 5. Atualizar consumidores de `main_coverages`
- `PlanosBeneficios.tsx` (vitrine de vendas): trocar `useMainCoverages()` por `useCoberturas()` filtrando `ativo=true`, mapeando `nome`→nome e `icon`→icone.
- Remover `useMainCoverages` de `usePlans.ts`
- Remover mutations de `main_coverages` de `usePlansAdmin.ts`
- Remover `CoberturasTab.tsx` e `CoberturaFormModal.tsx` antigos (ou adapta-los)

### 6. Limpar tipo `MainCoverage`
Remover de `types/plans.ts`. Substituir pelo tipo da tabela `coberturas`.

## Arquivos

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar (add cols + migrar dados) |
| `src/components/gestao-comercial/TabNavigation.tsx` | Editar label |
| `src/pages/diretoria/GestaoComercial.tsx` | Editar banner |
| `src/components/gestao-comercial/BeneficiosCoberturas.tsx` | Reescrever (abas) |
| `src/hooks/usePlans.ts` | Remover `useMainCoverages`, add `useCoberturas` |
| `src/hooks/usePlansAdmin.ts` | Remover mutations `main_coverages`, add mutations `coberturas` |
| `src/pages/vendas/PlanosBeneficios.tsx` | Trocar `useMainCoverages` por `useCoberturas` |
| `src/types/plans.ts` | Remover `MainCoverage`, add `Cobertura` |
| `src/components/admin/planos/CoberturaFormModal.tsx` | Adaptar para tabela `coberturas` |
| `src/components/admin/planos/CoberturasTab.tsx` | Remover ou redirecionar |

