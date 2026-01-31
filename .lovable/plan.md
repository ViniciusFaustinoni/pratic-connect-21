

# Exibição Flexível de Valores em Benefícios

## Contexto Atual

O sistema já possui campos flexíveis na tabela `plan_benefits`:
- `custom_text` → Texto customizado para exibição (ex: "Clube Gás (10% desconto)")
- `custom_value` → Valor associado (ex: "R$40mil", "40000")
- `additional_info` → Detalhes extras (ex: "(participação R$750)")

Atualmente, os valores são inseridos como texto livre, sem estrutura semântica que facilite formatos como:
- **Percentuais:** "até X%" ou "a partir de X%"
- **Monetários:** "até R$ Y" ou "a partir de R$ Y"

## Solução Proposta

Melhorar o formulário de seleção de benefícios (`BenefitsSelector.tsx`) para oferecer uma interface estruturada que gera automaticamente o texto formatado, mantendo a compatibilidade com o campo `custom_text` existente.

### Abordagem: Campos Estruturados com Preview em Tempo Real

Adicionar ao formulário de benefícios:

1. **Seletor de Prefixo** → "até", "a partir de", ou nenhum
2. **Campo de Valor Numérico** → Número puro (ex: 10, 100000)
3. **Seletor de Tipo de Valor** → "%" (percentual) ou "R$" (monetário)
4. **Preview em Tempo Real** → Mostra como ficará: "até 10% desconto"

O sistema gerará automaticamente o `custom_text` combinando esses elementos.

## Detalhamento Técnico

### Arquivo: `src/components/admin/planos/BenefitsSelector.tsx`

#### 1. Adicionar Novo Estado para Campos Estruturados

```typescript
interface BenefitValueConfig {
  prefix: 'ate' | 'a_partir_de' | 'exato' | '';
  value: string;
  valueType: 'percent' | 'currency';
  suffix: string; // Ex: "desconto", "cobertura"
}
```

#### 2. Função para Formatar Valor

```typescript
const formatBenefitValue = (config: BenefitValueConfig): string => {
  if (!config.value) return '';
  
  const prefixMap = {
    'ate': 'até',
    'a_partir_de': 'a partir de',
    'exato': '',
    '': '',
  };
  
  const prefix = prefixMap[config.prefix] || '';
  const formattedValue = config.valueType === 'currency' 
    ? `R$ ${Number(config.value).toLocaleString('pt-BR')}` 
    : `${config.value}%`;
  const suffix = config.suffix ? ` ${config.suffix}` : '';
  
  return `${prefix} ${formattedValue}${suffix}`.trim();
};
```

#### 3. Nova Interface de Entrada

Substituir o campo "Valor" atual por uma seção expandida com:

```typescript
{/* Seção de Valor Flexível */}
<div className="space-y-2">
  <Label className="text-xs">Valor do Benefício</Label>
  <div className="flex gap-2">
    {/* Prefixo */}
    <Select value={valueConfig.prefix} onValueChange={...}>
      <SelectItem value="">Exato</SelectItem>
      <SelectItem value="ate">até</SelectItem>
      <SelectItem value="a_partir_de">a partir de</SelectItem>
    </Select>
    
    {/* Valor numérico */}
    <Input 
      type="number"
      placeholder="10"
      value={valueConfig.value}
      onChange={...}
    />
    
    {/* Tipo (%/R$) */}
    <Select value={valueConfig.valueType} onValueChange={...}>
      <SelectItem value="percent">%</SelectItem>
      <SelectItem value="currency">R$</SelectItem>
    </Select>
  </div>
  
  {/* Sufixo opcional */}
  <Input 
    placeholder="Ex: desconto, cobertura"
    value={valueConfig.suffix}
    onChange={...}
  />
  
  {/* Preview */}
  {valueConfig.value && (
    <div className="text-sm bg-muted p-2 rounded flex items-center gap-2">
      <Check className="h-4 w-4 text-green-500" />
      <span>{benefit.name} ({formatBenefitValue(valueConfig)})</span>
    </div>
  )}
</div>
```

### Fluxo de Dados

```text
Entrada Estruturada:
  prefix: "ate"
  value: "10"
  valueType: "percent"
  suffix: "desconto"
       ↓
formatBenefitValue()
       ↓
custom_text: "até 10% desconto"
       ↓
Exibição: "Clube Gás (até 10% desconto)"
```

### Compatibilidade

- O campo `custom_text` continua disponível para entrada livre
- A nova interface é uma **alternativa** para facilitar formatos padronizados
- Dados existentes não são afetados

## Componentes de Exibição

Os componentes que exibem benefícios já usam `custom_text` e `custom_value`:
- `PlanoCardDynamic.tsx` → `getBenefitDisplayName()` já trata `custom_text`
- `PlanCard.tsx` → Já exibe `custom_text` e `custom_value` formatados
- `PlanoCardSelecao.tsx` → Usa array de strings (coberturas do plano legado)

**Nenhuma alteração necessária nos componentes de exibição.**

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/admin/planos/BenefitsSelector.tsx` | Adicionar interface estruturada para valores flexíveis |
| `src/hooks/usePlansAdmin.ts` | Verificar se `PlanBenefitInput` precisa de campos adicionais (opcional) |

## Exemplos de Uso

| Benefício | Configuração | Resultado |
|-----------|--------------|-----------|
| Clube Gás | prefix: "ate", value: "10", type: "percent", suffix: "desconto" | "até 10% desconto" |
| Danos Terceiros | prefix: "", value: "100000", type: "currency", suffix: "" | "R$ 100.000" |
| Reboque | prefix: "ate", value: "1000", type: "", suffix: "km" | "até 1000km" |
| Kit Gás | prefix: "ate", value: "2200", type: "currency", suffix: "" | "até R$ 2.200" |

## Resultado Esperado

1. **Interface melhorada** para cadastro de benefícios com valores estruturados
2. **Preview em tempo real** mostrando como o benefício será exibido
3. **Formatos padronizados** para "até X%", "a partir de R$ Y", etc.
4. **Compatibilidade total** com dados e componentes existentes
5. **Flexibilidade mantida** com campo de texto livre ainda disponível

