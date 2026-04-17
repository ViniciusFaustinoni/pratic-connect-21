

## Confirmação da causa raiz — Calculadora não responde ao "Calcular"

Reli `src/components/planos/CalculadoraPreco.tsx` linha por linha para confirmar.
<lov-tool-use id="toolu_vrtx_01HgKWuRm3i8mFdX6Kg9euw1" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/planos/CalculadoraPreco.tsx\", \"lines\": \"1-260\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_018hx5VZ56yr7g9k4oS5Nvuh" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/planos/CalculadoraPreco.tsx\", \"lines\": \"60-260\"}">
</lov-tool-use>
Causa raiz confirmada. Linhas 78, 110, 123, 181, 211, 228 — `useRef` em vez de `useState`. Refs não disparam re-render, então o hook `usePlanosCotacao` nunca é re-chamado com `valorFipe` real.

<lov-plan>

## Causa raiz (confirmada)

`src/components/planos/CalculadoraPreco.tsx`:

- **Linha 78**: `const jaCalculouRef = useRef(false);`
- **Linha 110**: `valorFipe: temFipe && jaCalculouRef.current ? fipeNumerico : 0`
- **Linha 181** (`handleCalcular`): `jaCalculouRef.current = true;`
- **Linha 228** (`showResults`): `jaCalculouRef.current && temFipe && ...`

**Refs não disparam re-render.** Sequência ao clicar "Calcular":
1. `handleCalcular` muda `jaCalculouRef.current` para `true`.
2. Se `fipeNumerico >= fipeMinimo`, faz `setFipeBloqueado(false)` — mas como já era `false`, **React faz bail-out e não re-renderiza**.
3. `usePlanosCotacao` continua sendo chamado com `valorFipe: 0` (valor da renderização anterior).
4. `showResults` continua `false`.
5. **Tela não muda. Botão parece morto.**

(Se o FIPE fosse abaixo do mínimo, o `setFipeBloqueado(true)` dispara re-render e o alerta apareceria — mas no caso normal, nada.)

Fix secundário: linha 88 não normaliza `r.codigo` com `.toLowerCase()` como os demais consumidores (`EtapaCriteriosCotacao`). Risco de mismatch se o banco devolver código maiúsculo.

## Correção

**1. Trocar `useRef` por `useState`** em `src/components/planos/CalculadoraPreco.tsx`:

- L78: `const [jaCalculou, setJaCalculou] = useState(false);`
- L110: `valorFipe: temFipe && jaCalculou ? fipeNumerico : 0`
- L123: `if (jaCalculou && temFipe) {`
- L181: `setJaCalculou(true);`
- L211: `setJaCalculou(false);`
- L228: `const showResults = jaCalculou && temFipe && !fipeBloqueado && planosCalculados.length > 0;`
- (verificar L635 também, mencionada na análise anterior)

**2. Padronizar região** (L88):
```ts
const REGIOES = useMemo(
  () => (regioesDb || []).map(r => ({ value: r.codigo.toLowerCase(), label: r.nome })),
  [regioesDb]
);
```

## Não mexer

- `usePlanosCotacao`, `consultarPlaca`, `handleValorChange`, layout dos cards de resultado.

## Validação

1. Comercial → Planos e Benefícios → Calculadora.
2. Pela placa `Q005C17` → Consultar → Calcular → lista de planos aparece.
3. Modo "Digitar FIPE" → preencher → Calcular → lista aparece.
4. FIPE abaixo do mínimo → alerta aparece (regressão).
5. Limpar → estado inicial.

## Resultado

Botão "Calcular" passa a renderizar os planos. Sem regressão no alerta de FIPE mínimo nem no fluxo de placa.

