

## Plano: Edição em massa de regras ao duplicar plano

### Contexto
Ao duplicar um plano, o modal já permite aplicar desconto (%) e sufixo. O usuário quer também poder configurar **Região**, **Tipo de Uso** e **Combustível** em massa, aplicando essas regras a todas as coberturas e benefícios clonados.

### Mudanças

#### 1. Modal `DuplicarPlanoModal.tsx`
- Adicionar 3 campos opcionais:
  - **Região**: Select com as regiões do banco (`regioes` table) + opção "Manter original"
  - **Tipo de Uso**: Select com opções "Manter original", "Particular", "Aplicativo"
  - **Combustível**: Select com opções "Manter original", "Gasolina", "Diesel"
- Passar os novos valores para `duplicatePlan.mutateAsync()`

#### 2. Hook `useDuplicatePlan` em `usePlansAdmin.ts`
- Expandir o tipo de input para aceitar `regiao?: string | null`, `tipoUso?: string | null`, `combustivel?: string | null`
- Após clonar as regras de elegibilidade de cada cobertura/benefício, aplicar a lógica de substituição em massa:
  - Se `regiao` foi informado: remover regras `rule_type = 'regiao'` clonadas e inserir uma nova regra de região com o valor selecionado (usando o UUID da região)
  - Se `tipoUso` foi informado: remover regras `rule_type = 'tipo_uso'` clonadas e inserir nova regra
  - Se `combustivel` foi informado: remover regras `rule_type = 'combustivel'` clonadas e inserir nova regra
- Também aplicar regra de região no nível do **plano** (`entity_type = 'plano'`) quando região for selecionada

#### 3. Busca de regiões
- Usar query simples à tabela `regioes` para popular o select do modal

### Detalhes técnicos

**Formato das regras inseridas** (baseado no padrão existente em `entity_eligibility_rules`):
```json
// Região (usando UUID)
{ "entity_id": "<id>", "entity_type": "cobertura", "rule_type": "regiao", "rule_config": { "values": ["<regiao_uuid>"] }, "is_active": true }

// Tipo de uso
{ "entity_id": "<id>", "entity_type": "cobertura", "rule_type": "tipo_uso", "rule_config": { "tipos_uso": ["particular"] }, "is_active": true }

// Combustível
{ "entity_id": "<id>", "entity_type": "cobertura", "rule_type": "combustivel", "rule_config": { "combustiveis": ["gasolina"] }, "is_active": true }
```

**Arquivos modificados:**
- `src/components/admin/planos/DuplicarPlanoModal.tsx` — adicionar campos de região, tipo de uso e combustível
- `src/hooks/usePlansAdmin.ts` — expandir `useDuplicatePlan` com lógica de substituição de regras em massa

