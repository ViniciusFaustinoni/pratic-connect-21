## Bug

Ao abrir um associado, a página quebra com `RUNTIME_ERROR: Rendered more hooks than during the previous render`. Os warnings de `forwardRef` (Select/Dialog) que aparecem antes são ruído — não causam o crash.

## Causa raiz

Em `src/pages/cadastro/AssociadoDetalhe.tsx`, quatro hooks são chamados **depois** dos early returns:

```text
linha 342:  if (isLoading) return <Skeleton />;     ← early return #1
linha 355:  if (!associado) return <NotFound />;     ← early return #2
...
linha 409:  const queryClient = useQueryClient();        ← hook
linha 410:  const [reenvioDialogOpen, setReenvioDialogOpen] = useState(false);
linha 411:  const solicitarDocsMutation = useSolicitarDocumentos();
linha 412:  const { data: docsJaSolicitados } = useDocumentosSolicitadosPendentes(id);
```

Na primeira render `isLoading=true` → React conta N hooks. Na segunda render `isLoading=false` → React encontra N+4 hooks → crash. É a regra dos hooks do React (sempre na mesma ordem, sem condicionais nem returns antes deles).

## Correção

Mover os 4 hooks (linhas 409-412) para junto dos outros `useState`/`useQuery` no topo do componente, antes do bloco `if (isLoading)`. Nenhuma mudança de comportamento — só reordenação para respeitar a regra dos hooks.

## Validação

- A tela de detalhe do associado abre sem crash.
- O dialog de "Solicitar reenvio de documentos" continua funcionando (mesmo state, mesma mutation, só movidos de lugar).
- Sem regressão em outras telas (mudança isolada em um único arquivo).
