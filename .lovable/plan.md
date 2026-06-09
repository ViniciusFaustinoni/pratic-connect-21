## Causa raiz

A `DialogContent` em `src/components/associados/TrocaTitularidadeDialog.tsx` (linha 289) usa:

```tsx
<DialogContent className="max-w-md relative">
```

O `cn()` aplica `tailwind-merge`, que **deduplica utilitários conflitantes da mesma categoria** (no caso, `position`). A base do `DialogContent` (`src/components/ui/dialog.tsx`) começa com `fixed left-[50%] top-[50%] … translate-x-[-50%] translate-y-[-50%] …`. Quando o consumidor passa `relative`, o merge mantém **só `relative`** e descarta `fixed`.

Resultado:

- `position: relative` faz com que `left:50%` e `top:50%` virem coordenadas **dentro do containing block ancestral** (a barra `flex items-center gap-2` no header de `Cotacoes.tsx`, onde `NovaEntradaDialog` está renderizado).
- A `DialogContent` aparece grudada na borda direita da tela (próximo ao botão "+ Nova Cotação"), com largura mal calculada (header + alert ficam fora do viewport, só os campos de formulário aparecem), e sem nenhum overlay escurecendo a tela.
- Bug não é a colisão entre os dois Dialogs que tentei resolver com `setTimeout(220)` na resposta anterior — o `delay` não conserta porque o problema é puramente CSS na própria `DialogContent` da Troca.

O `relative` foi colocado lá originalmente para servir de âncora ao overlay `<div className="absolute inset-0 z-20 …">` do progresso de "Criando solicitação de troca…". Mas `position: fixed` **também é** "positioned", então o `absolute` filho já se ancora corretamente na própria `DialogContent` sem precisar do `relative`.

## Plano

### 1. Corrigir `src/components/associados/TrocaTitularidadeDialog.tsx`
Remover `relative` da className da `DialogContent`:

```tsx
<DialogContent className="max-w-md">
```

O overlay interno `<div className="absolute inset-0 …">` continua se ancorando corretamente, agora à `DialogContent` em `position: fixed` (que já é containing block para `absolute`).

### 2. Reverter o paliativo do `OutrasEntradasMenu.tsx`
A resposta anterior introduziu `onOpenChange(false); setTimeout(() => setShowTrocaTitularidade(true), 220)` nos dois pontos de abertura (busca de associado e redirecionamento de substituição). Com a causa real corrigida, o `setTimeout` vira ruído: atrasa a abertura sem necessidade e reintroduz a janela em que o `useEffect` de reset poderia zerar `selectedAssociadoId` se a guarda `!showTrocaTitularidade` falhar.

Voltar à ordem original do código: abrir `setShowTrocaTitularidade(true)` **antes** de fechar o chooser, conforme o comentário canônico:
```tsx
setShowTrocaTitularidade(true);
setTimeout(() => onOpenChange(false), 0);
```

### 3. Auditar outros `DialogContent` com classes de posição conflitantes
Varrer o projeto por `DialogContent className="..."` contendo `relative`, `absolute`, `static` ou `sticky` e remover/refatorar — qualquer um desses quebra a posição `fixed` da base via tailwind-merge. Mesma varredura para `AlertDialogContent`. Reportar achados; corrigir os que estiverem claramente errados (manter apenas se houver justificativa documentada).

### 4. Memória do projeto
Criar `mem://constraints/ui/dialog-content-position-fixed-imutavel` registrando:
- `DialogContent`/`AlertDialogContent` **nunca** podem receber `relative`/`absolute`/`static`/`sticky` na className — `tailwind-merge` derruba o `fixed` da base e o modal desancorra do viewport.
- Para ancorar overlays internos, basta `absolute inset-0` no filho (o `fixed` da `DialogContent` já é containing block).
- Caso de referência: `TrocaTitularidadeDialog` 09/06/26 — modal apareceu grudado na borda direita do header de `/vendas/cotacoes`.

## Resultado esperado

- Modal de Troca de Titularidade volta a abrir centralizado no viewport, com overlay escuro, header ("Troca de Titularidade" + descrição), alerta informativo e formulário completos e roláveis dentro do dialog.
- O overlay de progresso ("Criando solicitação de troca…") continua cobrindo o conteúdo do modal corretamente.
- Sem necessidade de delays artificiais entre fechar o chooser e abrir a Troca.

## Fora do escopo

- Não vou adicionar `<DialogPortal>` à base `dialog.tsx` (mudança grande de escopo cross-app — proposta separada se quiser, mas não resolve este bug).
- Não vou mexer no fluxo de busca SGA, `importar-associado-sga`, nem na lógica de criação da troca.
