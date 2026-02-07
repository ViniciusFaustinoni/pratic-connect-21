
# Plano: Corrigir Erro de Select.Item com Valor Vazio

## Problema Identificado

O erro ocorre porque o componente `<SelectItem value="">` na linha 382 do arquivo `AgendarVistoriaModal.tsx` usa string vazia como valor:

```tsx
<SelectItem value="">Qualquer horário</SelectItem>
```

O Radix UI Select **não permite** `value=""` em `SelectItem` porque o valor vazio é reservado para limpar a seleção e mostrar o placeholder.

## Solução

Substituir o valor vazio por um valor significativo (como `"any"` ou `"qualquer"`) e ajustar a lógica para tratar esse valor especial.

## Alterações no Arquivo

**Arquivo:** `src/components/monitoramento/AgendarVistoriaModal.tsx`

### Mudança 1: Linha 382 - Substituir valor vazio

**Antes:**
```tsx
<SelectItem value="">Qualquer horário</SelectItem>
```

**Depois:**
```tsx
<SelectItem value="any">Qualquer horário</SelectItem>
```

### Mudança 2: Linha 376 - Ajustar handler

**Antes:**
```tsx
onValueChange={(value) => updateForm('horarioEspecifico', value || undefined)}
```

**Depois:**
```tsx
onValueChange={(value) => updateForm('horarioEspecifico', value === 'any' ? undefined : value)}
```

### Mudança 3: Linha 375 - Ajustar valor exibido

**Antes:**
```tsx
value={formData.horarioEspecifico || ''}
```

**Depois:**
```tsx
value={formData.horarioEspecifico || 'any'}
```

## Impacto em Outros Arquivos

Existem 14 arquivos com o mesmo problema (`SelectItem value=""`). Porém, eles podem não estar causando erros visíveis no momento porque:
1. Os componentes podem não estar sendo renderizados
2. Os valores vazios podem não estar sendo selecionados

Recomendo corrigir apenas o arquivo que está causando o erro agora, e os demais podem ser corrigidos em uma tarefa futura de refatoração.

## Resultado Esperado

Após a correção:
- O modal de agendamento abrirá sem erros
- A opção "Qualquer horário" funcionará corretamente
- O formulário continuará tratando a ausência de horário específico como `undefined` internamente
