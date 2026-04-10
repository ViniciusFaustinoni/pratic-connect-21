

## Plano: Duplicar Linha completa com modificadores + Excluir linha em cascata

### Situacao atual

- **Duplicar Linha**: `useDuplicateProductLine` apenas clona a linha (metadata), sem copiar nenhum plano.
- **Excluir Linha**: `useDeleteLinha` apaga planos_coberturas, planos_beneficios, regras do plano, mas NAO apaga as coberturas e benefits criados para cada plano (ficam orfaos no banco).

### O que sera feito

#### 1. Modal `DuplicarLinhaModal` (novo componente)

Semelhante ao `DuplicarPlanoModal`, com os campos:
- **Desconto (%)** - aplicado a todos os valores financeiros de todas as coberturas e beneficios de todos os planos
- **Sufixo** - aplicado ao nome da linha e de todos os planos, coberturas e beneficios
- **Regiao** - manter original ou substituir em todos os planos/coberturas/beneficios
- **Tipo de Uso** - manter original ou substituir (particular/aplicativo)
- **Tipo de Veiculo** - manter original ou substituir (carro/moto) — seta o `vehicle_type` da linha e `categorias_veiculo` dos planos
- **Combustivel** - manter original ou substituir (gasolina/diesel)

#### 2. Hook `useDuplicateProductLine` reescrito em `usePlansAdmin.ts`

Logica:
1. Clonar a linha (`product_lines`) com sufixo e vehicle_type
2. Para cada plano da linha original, reutilizar a logica existente de `useDuplicatePlan` (que ja clona coberturas, beneficios, regras, exclusoes, planos_coberturas com todos os campos financeiros e desconto)
3. Cada plano clonado aponta para a nova linha

#### 3. Excluir Linha em cascata completa

Alterar `useDeleteLinha` em `LinhasPlanos.tsx` para tambem excluir:
- Coberturas (`coberturas`) vinculadas via `planos_coberturas`
- Benefits (`benefits`) vinculados via `planos_beneficios`
- Regras de elegibilidade de coberturas e beneficios (entity_eligibility_rules)
- Exclusoes de categoria (benefit_category_exclusions)

#### 4. UI em `LinhasPlanos.tsx`

- Trocar o botao de duplicar linha (que hoje faz `duplicateLine.mutate(linha.id)` direto) para abrir o novo `DuplicarLinhaModal`
- Adicionar estado para controlar o modal

### Arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/admin/planos/DuplicarLinhaModal.tsx` | Novo componente (modal com campos de configuracao) |
| `src/hooks/usePlansAdmin.ts` | Reescrever `useDuplicateProductLine` para aceitar modificadores e iterar sobre todos os planos usando a logica de `useDuplicatePlan` |
| `src/components/gestao-comercial/LinhasPlanos.tsx` | Abrir modal ao duplicar linha; completar cascata no delete (coberturas, benefits, regras, exclusoes) |

