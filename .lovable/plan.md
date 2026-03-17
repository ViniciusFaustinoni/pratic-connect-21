

## Plano: Aba "Elegibilidade" no Modal de Edição de Planos + cobertura_fipe por regra

### Resumo

Adicionar uma aba "Elegibilidade" ao `PlanFormModal` que permite ao diretor configurar regras de aceitação por marca/modelo/ano diretamente na edição do plano. Inclui campo de cobertura FIPE por regra e suporte a lógica inversa (whitelist: só modelos listados são aceitos). Também atualizar o motor de cotação para usar `cobertura_fipe` da regra quando status = limitado.

### 1. Migration: coluna `cobertura_fipe`

```sql
ALTER TABLE plano_elegibilidade_modelos
ADD COLUMN IF NOT EXISTS cobertura_fipe integer DEFAULT 100;
```

Permite configurar cobertura diferenciada (ex: BMW = 70% FIPE).

### 2. Novo componente: `src/components/admin/planos/ElegibilidadeTab.tsx`

Componente autônomo que recebe `planoId` e `linhaSlug` como props. Faz CRUD direto na tabela `plano_elegibilidade_modelos`.

**Estrutura:**
- Texto explicativo sobre whitelist: "Modelos listados aqui formam uma whitelist. Veículos NÃO listados serão negados na cotação."
- Tabela com colunas: Marca, Modelo, Ano Min/Max, Combustível, Status (aceito/limitado/negado), Cobertura FIPE (%), Obs, Ações
- Botão "Adicionar Regra" abre formulário inline com campos: marca (text uppercase), modelo (text uppercase ou "TODOS OS MODELOS"), ano min/max, combustível, status, cobertura_fipe (input number, default 100), observação
- Editar/Remover (soft delete via is_active=false)
- Reutilizar padrões do `ElegibilidadeVeiculos.tsx` existente (mesma estrutura de mutation, duplicate check, etc.)

### 3. Integrar aba no `PlanFormModal.tsx` (L444-449)

Adicionar tab "Elegibilidade" ao TabsList, disponível apenas quando editando (plano já tem ID):

```tsx
<TabsTrigger value="elegibilidade" disabled={!isEditing}>Elegibilidade</TabsTrigger>
```

```tsx
<TabsContent value="elegibilidade">
  {plan?.id ? (
    <ElegibilidadeTab planoId={plan.id} linhaSlug={formData.linha_slug || ''} />
  ) : (
    <p className="text-sm text-muted-foreground py-4">Salve o plano primeiro para configurar elegibilidade.</p>
  )}
</TabsContent>
```

### 4. Motor de cotação: usar `cobertura_fipe` (`usePlanosCotacao.ts`)

- Adicionar `cobertura_fipe` ao select da query de elegibilidade (L179)
- `verificarElegibilidadeModelo` retorna objeto `{ status, coberturaFipe }` em vez de string
- Quando `status === 'limitado'` e `coberturaFipe < 100`, aplicar ao cálculo de cobertura do plano
- Atualizar todos os call sites para usar o novo retorno

### Arquivos afetados

- Migration SQL (nova coluna `cobertura_fipe`)
- `src/components/admin/planos/ElegibilidadeTab.tsx` (novo)
- `src/components/admin/planos/PlanFormModal.tsx` (nova aba)
- `src/hooks/usePlanosCotacao.ts` (retorno enriquecido + aplicar cobertura)

