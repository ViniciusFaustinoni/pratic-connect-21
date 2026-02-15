

# Corrigir auto-preenchimento de Modelo e Ano no Orcamento

## Problema

A marca eh encontrada e selecionada corretamente (como mostrado na screenshot com "Toyota"), mas o modelo e o ano nao sao preenchidos. Isso ocorre por um bug de "stale closure" nos `useEffect` do componente `PecaSelectFields`.

Quando o `useEffect` de marcas chama `onChange(...)`, o React re-renderiza o componente com novos `values`. Porem, o `useEffect` de modelos (que depende de `values.marcaCodigo`) captura `values` e `onChange` do closure anterior, causando conflitos: ao chamar `onChange({ ...values, modeloCodigo: ... })`, o spread de `values` antigo pode sobrescrever campos ja atualizados.

## Solucao

Usar `useRef` para manter referencias atualizadas de `values` e `onChange`, garantindo que os efeitos de auto-match sempre acessem os valores mais recentes.

## Alteracoes

### Arquivo: `src/components/oficinas/PecaSelectFields.tsx`

1. Adicionar refs para `values` e `onChange` que sao atualizados a cada render:

```typescript
const valuesRef = useRef(values);
valuesRef.current = values;
const onChangeRef = useRef(onChange);
onChangeRef.current = onChange;
```

2. Nos 3 `useEffect` de auto-match, substituir `values` por `valuesRef.current` e `onChange` por `onChangeRef.current`:

- **Effect de marcas (linha ~63-74)**: usar `valuesRef.current` no spread e `onChangeRef.current` para chamar o callback
- **Effect de modelos (linha ~78-91)**: mesmo ajuste -- usar refs em vez de closure
- **Effect de anos (linha ~95-108)**: mesmo ajuste

3. Separar o flag de auto-match em 3 flags independentes (`autoMatchMarcaRef`, `autoMatchModeloRef`, `autoMatchAnoRef`) para evitar que o match de marca bloqueie ou interfira nos matches subsequentes. A marca marca `autoMatchMarcaRef = true`, o modelo verifica `autoMatchMarcaRef.current && !autoMatchModeloRef.current`, e o ano verifica `autoMatchModeloRef.current && !autoMatchAnoRef.current`.

## Resultado esperado

Ao abrir o modal de orcamento e adicionar uma peca:
1. Marca eh selecionada automaticamente (ex: "Toyota")
2. Modelos carregam e o modelo correspondente eh selecionado (ex: "Corolla")
3. Anos carregam e o ano correspondente eh selecionado (ex: "2022")

O regulador ainda pode alterar qualquer campo manualmente.
