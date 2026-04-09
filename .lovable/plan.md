

## Plano: Garantir que cada cobertura e beneficio pertenca a apenas um plano

### Estado atual
- Nenhuma cobertura ou beneficio esta duplicado entre planos (dados limpos)
- Nao existe constraint UNIQUE em `cobertura_id` na tabela `planos_coberturas` (apenas unique composta `plano_id + cobertura_id`)
- Nao existe constraint UNIQUE em `benefit_id` na tabela `planos_beneficios`

### Alteracoes

**1. Migration SQL — adicionar constraints UNIQUE**
```sql
ALTER TABLE planos_coberturas ADD CONSTRAINT planos_coberturas_cobertura_id_unique UNIQUE (cobertura_id);
ALTER TABLE planos_beneficios ADD CONSTRAINT planos_beneficios_benefit_id_unique UNIQUE (benefit_id);
```
Isso impede no nivel do banco que a mesma cobertura ou beneficio seja vinculado a mais de um plano.

**2. `src/components/gestao-comercial/VincularBeneficioModal.tsx`**
- Alterar a query de beneficios disponiveis para excluir beneficios que ja estao vinculados a **qualquer** plano (nao apenas ao plano atual)
- Atualmente filtra apenas por `plano_id = planoId`; mudar para buscar todos os `benefit_id` da tabela `planos_beneficios`

**3. `src/components/admin/planos/PlanCoberturasList.tsx`**
- No seletor de coberturas para vincular, filtrar coberturas que ja estao vinculadas a qualquer plano (query em `planos_coberturas` sem filtro de `plano_id`)

**4. `src/components/gestao-comercial/PlanoFormSheet.tsx`**
- Na selecao de coberturas ao criar/editar plano, filtrar coberturas ja atribuidas a outros planos (excluindo o plano em edicao)

**5. `src/hooks/usePlansAdmin.ts`**
- Na duplicacao de plano, como cada cobertura/beneficio e clonada (cria nova entidade), nao ha conflito — manter como esta

### Resultado
- Banco impede duplicatas via constraint
- UI mostra apenas itens disponiveis (nao atribuidos a outro plano)
- Duplicacao de planos continua funcionando (clona entidades)

### Arquivos
- Migration SQL (nova)
- `src/components/gestao-comercial/VincularBeneficioModal.tsx`
- `src/components/admin/planos/PlanCoberturasList.tsx`
- `src/components/gestao-comercial/PlanoFormSheet.tsx`

