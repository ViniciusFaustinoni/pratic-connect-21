
# Correcao: Botao "Proximo" nao funcional quando item NOK no checklist

## Diagnostico

O botao "Proximo" fica desabilitado (mesmo parecendo azul) porque a validacao `checklistCompleto` exige que itens marcados como NOK tenham uma observacao preenchida (`state.observacao?.trim()`). Sem essa observacao, `podeAvancar()` retorna `false` e o botao nao responde ao clique.

Alem disso, o estilo `bg-blue-600` aplicado diretamente no botao sobrescreve o estilo visual de "disabled", fazendo o botao parecer ativo quando na verdade esta desabilitado — confundindo o instalador.

## Correcao

### Arquivo: `src/pages/instalador/InstaladorChecklist.tsx`

**1. Simplificar validacao do checklist (linha 264-270)**

Remover a exigencia de observacao para considerar o checklist completo. Basta que todos os itens tenham status `ok` ou `nok` (nao `pendente`):

```typescript
// Antes:
const checklistCompleto = useMemo(() => 
  checklistItems.every(item => {
    const state = checklist[item.id];
    if (state?.status === 'ok') return true;
    if (state?.status === 'nok' && state.observacao?.trim()) return true;
    return false;
  }),
  [checklist, checklistItems]
);

// Depois:
const checklistCompleto = useMemo(() => 
  checklistItems.every(item => {
    const state = checklist[item.id];
    return state?.status === 'ok' || state?.status === 'nok';
  }),
  [checklist, checklistItems]
);
```

A observacao continua disponivel e incentivada na interface (o campo aparece quando o item e NOK), mas nao bloqueia o avanco. O dialog de confirmacao (etapa intermediaria) ja serve como ponto de decisao.

**2. Corrigir estilo do botao desabilitado (linha 1918-1925)**

Adicionar classe condicional para que o botao fique visualmente apagado quando desabilitado:

```typescript
// Antes:
className="flex-1 bg-blue-600 hover:bg-blue-700"

// Depois:
className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
```

## Resultado

- Instalador marca todos os itens (ok ou nok) → botao "Proximo" fica ativo
- Se houver itens NOK → clique abre o dialog de confirmacao (ja implementado)
- Se algum item ainda estiver pendente → botao fica visivelmente desabilitado (opaco)
- Observacoes continuam opcionais mas disponiveis

Apenas 1 arquivo editado. Nenhuma migration necessaria.
