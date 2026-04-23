

## Erro "Select.Item must have a value prop that is not an empty string" em Filtros / Exportação de Associados

### Diagnóstico

O erro vermelho no screenshot ("A `<Select.Item />` must have a value prop that is not an empty string") aparece quando o usuário clica em **Filtros** na tela `/cadastro/associados`. O componente `ExportAssociadosDialog` em si está OK — não usa `Select`. Quem quebra o render é o painel `AssociadoFilters` (`src/components/cadastro/AssociadoFilters.tsx`), com **dois** problemas que violam a regra do Radix Select:

1. **Linha 195** — opção "Todas as cidades" usa `value=""`:
   ```tsx
   <SelectItem value="">Todas as cidades</SelectItem>
   ```
   Radix proíbe explicitamente string vazia em `<SelectItem value>` (a mensagem que apareceu na tela é literal do Radix).

2. **Linha 171 + state inicial linha 84** — o `Select` de Plano recebe `value={plano}` cujo estado inicial é `''` (`useState(initialFilters?.plano_id || '')`). Isso já causa warning do Radix em algumas versões e fica fragil quando o usuário "Limpa" filtros (linha 121 reseta `plano` para `''`). O `Select` espera `undefined` para "vazio" ou um valor sentinela como `'all'`.

A consequência é o ErrorBoundary global capturar e mostrar a tela "Ocorreu um erro ao carregar a página" — daí o filtro **e** a exportação aparentam estar quebrados (a tela toda some).

### Correção

Apenas em `src/components/cadastro/AssociadoFilters.tsx`. Padrão sentinela `'all'` para "vazio", consistente com o que já é feito no resto da página (`statusFilter='all'`, `planoFilter='all'`, `cidadeFilter='all'` em `Associados.tsx`).

**1. State inicial (linhas 83-84)**
```tsx
const [plano, setPlano] = useState(initialFilters?.plano_id || 'all');
const [cidade, setCidade] = useState(initialFilters?.cidade || 'all');
```

**2. Select de Plano (já tem `<SelectItem value="all">Todos os planos</SelectItem>`) — sem mudança no JSX.**

**3. Select de Cidade (linhas 190-200)** — trocar `value=""` por `value="all"`:
```tsx
<SelectItem value="all">Todas as cidades</SelectItem>
```
e ajustar o `<Select value={cidade}>` para nunca receber string vazia.

**4. `handleApply` (linhas 107-117)** — só envia o filtro quando ≠ `'all'`:
```tsx
if (plano && plano !== 'all') filters.plano_id = plano;
if (cidade && cidade !== 'all') filters.cidade = cidade;
```
(`plano` já estava certo; `cidade` precisa do mesmo tratamento.)

**5. `handleLimpar` (linhas 119-125) e `activeCount` (linhas 127-131)** — usar `'all'` em vez de `''`:
```tsx
setPlano('all'); setCidade('all');
// activeCount: (cidade && cidade !== 'all' ? 1 : 0)
```

**6. Fallback Input (linha 202)** — quando `cidades` está vazio, o `Input` continua aceitando string livre; não muda nada porque é um `<Input>`, não `<SelectItem>`.

### O que NÃO muda

- `ExportAssociadosDialog.tsx` — já está correto, sem `Select` problemático.
- `Associados.tsx` (página) — já usa sentinela `'all'`.
- Tipagem `SheetFiltersValue`, hooks `useAssociados`, RLS, queries.
- Comportamento da tela após o fix: "Todas as cidades" / "Todos os planos" continua significando "sem filtro".

### Arquivo editado

- `src/components/cadastro/AssociadoFilters.tsx` — substituir `''` por `'all'` em state inicial, `SelectItem` da cidade, `handleApply`, `handleLimpar` e `activeCount`.

### Risco

- Nenhum. Sentinela `'all'` é o mesmo padrão já aplicado em `Associados.tsx`. Filtros pré-existentes vindos por `initialFilters` continuam funcionando (string com UUID/cidade real é diferente de `'all'`).

