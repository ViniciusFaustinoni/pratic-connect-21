
## Diagnóstico

Erro: **Minified React error #310** = *"Rendered more hooks than during the previous render."*

Isso acontece quando algum componente entre dois renders consecutivos altera o número de hooks executados (tipicamente um `early return` antes de um hook, ou um hook chamado dentro de condição/loop que muda).

### O que já foi confirmado pela leitura do código

- `src/pages/cadastro/AssociadoDetalhe.tsx` (componente raiz da modal):
  - Os hooks no topo do componente estão corretamente posicionados antes dos `early returns` (`if (isLoading) return …`, `if (!associado) return …`). Já existe inclusive o comentário "Hooks que antes estavam após early returns (corrige Rendered more hooks…)" — ou seja, o mesmo bug já ocorreu nesse arquivo no passado.
  - O componente é renderizado dentro de um `<Dialog>` em `Associados.tsx`, com `{detalheAssociadoId && <AssociadoDetalhe …/>}`. A modal monta/desmonta a cada abertura — então cada clique inicia uma sequência (1ª render: dados ainda em loading → 2ª render: dados chegam) onde a contagem de hooks precisa ser idêntica.

- Dados do associado LRA9681 (CLEBER LUIZ DE OLIVEIRA LIMA / `ec43f40d-…`) não têm nada visivelmente corrompido; o que difere de outros associados é que **`cnh_categoria` é `NULL`** e o veículo tem `valor_fipe = 11.763` (Yamaha 2013). Esses dados sozinhos não deveriam quebrar React, mas servem para reproduzir.

### Onde está o risco real (os 3 candidatos prováveis)

1. **`AssociadoDetalhe.tsx`, linhas 762-777** — o uso de duas IIFE `(() => {…})()` dentro do `veiculos.map()` (botões "Ativar rastreador" e "Concluir instalação prestador") está OK em termos de hooks, **mas** a expressão condicional do botão de "Ativar rastreador" tem um agrupamento perigoso:
   ```jsx
   {v.rastreador && (
     (v.rastreador.plataforma === 'softruck' && !v.rastreador.plataforma_device_id) ||
     (v.rastreador.plataforma === 'rede_veiculos' && !v.rede_veiculos_cliente_id)
   ) && ( <Button …/> )}
   ```
   Devido à precedência, isso pode renderizar `false` como filho ao invés de `null` em alguns ramos — não é a causa do #310, mas merece limpeza.

2. **Render condicional do `<Dialog>`** em `Associados.tsx` (linha 970-982): o `DialogContent` envolve `AssociadoDetalhe` num `{detalheAssociadoId && (<div>…</div>)}`. Quando o usuário fecha → reabre rapidamente, a modal pode disparar dois ciclos de mount com `useAssociado(id)` em estados diferentes. **Não é a raiz**, mas vamos garantir um `key={detalheAssociadoId}` para forçar uma árvore nova a cada associado.

3. **Causa mais provável** — algum componente filho que renderiza diferentes números de hooks dependendo de uma prop que muda entre renders. Os candidatos no caminho da aba "Resumo" (default) são:
   - `AssociadoHeroHeader` — hooks estáveis (apenas `useNavigate`).
   - `AlertSuspensaoNaoInstalacao` — hooks estáveis (`useAuth`, `useState`, `useQuery`).
   - `SubstituicaoStatusCard` — hooks estáveis (`useNavigate`, `useQuery`).
   - `AssociadoSituacaoCard` — sem hooks; é puro.
   - `OrigemCadastroCard` — usa `useOrigemCadastro` (1 query) e renderiza Render* sub-components que **não chamam hooks**. Estável.
   - `useAssociadoSituacao` — chama hooks dependentes em cascata: `useInadimplenciaPrazos`, `useCarenciaDiasPadrao`, `useMultaRastreador`, `useMigracaoConfig`, `useInadimplenciaPorVeiculo`, mais 4 `useQuery` próprios + 1 `useMemo`. Como `planoId` (e `vendedorId`) começam `undefined` e depois assumem valor, **as queries permanecem montadas (apenas `enabled` muda)** → contagem de hooks estável. OK.

   O candidato remanescente é o `useInadimplenciaPorVeiculo` ou algum dos `useConteudosSistema`, que precisamos auditar para garantir que nenhum chame `useQuery` condicionalmente.

## Plano de ação

### 1. Auditar e blindar hooks suspeitos (raiz do #310)

- Ler `src/hooks/useInadimplenciaPorVeiculo.ts` e `src/hooks/useConteudosSistema.ts` (`useInadimplenciaPrazos`, `useCarenciaDiasPadrao`, `useMultaRastreador`, `useMigracaoConfig`, `useConfiguracaoJson`) e garantir que **nenhum hook seja chamado dentro de condicional/early return**. Onde houver, mover para topo da função.
- Confirmar que `useFotosVistoriaUnificada` mantém quantidade de hooks fixa para qualquer combinação de `contratoId`/`cotacaoId` (incluindo ambos `undefined`).

### 2. Estabilizar a modal de detalhe

- Em `src/pages/cadastro/Associados.tsx`, adicionar `key={detalheAssociadoId}` no `<AssociadoDetalhe>` dentro do `Dialog`, garantindo árvore nova por associado e impedindo qualquer "vazamento" de estado entre aberturas.
- Adicionar `<DialogTitle>` (visível ou via `VisuallyHidden`) para silenciar o warning do Radix e descartar interferência de overlay.

### 3. Defesa em profundidade no `AssociadoDetalhe`

- Em `src/pages/cadastro/AssociadoDetalhe.tsx`:
  - Re-passar todos os hooks por uma checagem manual: nenhum hook deve aparecer abaixo das linhas dos `if (isLoading) return …` (347) e `if (!associado) return …` (360). Confirmar que `criarSolicitacaoRetirada` (linha 243), `useAssociadoSituacao` (281) e demais permaneçam acima.
  - Limpar a expressão condicional do botão "Ativar rastreador" (linhas 762-777) extraindo para uma variável booleana `const precisaAtivarPlataforma = …` para evitar agrupamento ambíguo.
  - Envolver o `return (…)` principal num `ErrorBoundary` local que mostre uma mensagem amigável (ao invés do erro genérico atual) e logue o erro com `id` do associado para facilitar reprodução futura.

### 4. ErrorBoundary com diagnóstico

- Criar `src/components/common/AssociadoDetalheErrorBoundary.tsx`:
  - Captura erro, mostra "Falha ao carregar associado", botão "Recarregar" e "Copiar diagnóstico".
  - Loga `console.error` com `{ associadoId, error, componentStack }`.
- Aplicar o boundary tanto no roteamento direto (`/cadastro/associados/:id`) quanto dentro da modal em `Associados.tsx`.

### 5. Verificação

- Rebuildar e abrir a modal em LRA9681 para confirmar que o erro sumiu.
- Conferir 3 associados de tipos diferentes (ativo com vários veículos, suspenso, em análise) para garantir não-regressão.
- Se o erro persistir após o passo 1, o ErrorBoundary do passo 4 dará o componente exato no `componentStack`, finalizando a investigação.

## Detalhes técnicos

```text
AssociadoDetalhe (root, hooks ok)
 ├─ AssociadoHeroHeader               (hooks ok)
 ├─ AlertSuspensaoNaoInstalacao       (hooks ok)
 ├─ SubstituicaoStatusCard            (hooks ok)
 ├─ AssociadoResumoTab
 │   ├─ AssociadoSituacaoCard         (puro)
 │   └─ OrigemCadastroCard            (1 query — ok)
 └─ useAssociadoSituacao              (cadeia de ~10 hooks — auditar dependências)
      ├─ useInadimplenciaPrazos       ← AUDITAR
      ├─ useCarenciaDiasPadrao        ← AUDITAR
      ├─ useMultaRastreador           ← AUDITAR
      ├─ useMigracaoConfig            ← AUDITAR
      └─ useInadimplenciaPorVeiculo   ← AUDITAR
```

## O que NÃO será alterado

- A lógica de negócio (carências, inadimplência, depreciação, ativação de rastreador). Apenas o esqueleto de hooks/render para eliminar o crash.
- Nenhuma migração de banco é necessária.

## Pergunta antes de implementar

O usuário relatou que **apenas LRA9681** apresenta o erro hoje, mas a correção é estrutural (mexe na cadeia de hooks que serve **todos** os associados). Você prefere:

1. Aplicar tudo agora (auditar hooks + ErrorBoundary + `key` da modal) — risco baixo, cobre todos os casos.
2. Apenas adicionar o ErrorBoundary primeiro para capturar o `componentStack` exato e depois corrigir a causa pontual em uma segunda iteração — minimiza mudanças, mas exige reabrir o caso amanhã.

Recomendo a **opção 1** (mais segura para evitar que apareça em outros associados sem aviso).
