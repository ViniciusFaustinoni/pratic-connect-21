

# Corrigir Auto-Avanço de Fotos do Vistoriador

## Causa raiz

O `useEffect` de auto-avanço usa `isFotoEnviada()` para encontrar a próxima foto pendente. Essa função depende de `fotosEnviadas`, que vem de um react-query. Quando o upload termina (`uploadingFoto` vai de `"id"` para `null`), o react-query ainda não refez o fetch — então `isFotoEnviada` retorna dados **desatualizados**. A foto recém-enviada não aparece como enviada, e a busca pela "próxima pendente" pode falhar ou selecionar a mesma foto.

O delay de 600ms nem sempre é suficiente para o refetch completar, especialmente em conexões lentas.

## Correção

### `src/components/vistorias/VistoriaFotoSequencial.tsx`

Simplificar drasticamente o auto-avanço: em vez de procurar a "próxima pendente" (que depende de dados atualizados do servidor), **manter um Set local de fotos já enviadas nesta sessão** e usar isso para o avanço.

1. Adicionar estado local `uploadedLocally` (`Set<string>`) que é preenchido quando o upload termina
2. No `useEffect` de auto-avanço, quando `prevUploadingRef.current` tinha valor e `uploadingFoto` virou `null`:
   - Adicionar `uploadedId` ao `uploadedLocally`
   - Buscar a próxima foto onde `!isFotoEnviada(f.id) && !uploadedLocally.has(f.id)` — usando tanto os dados do servidor quanto o tracking local
   - Avançar imediatamente (sem delay de 600ms, ou com delay menor de 300ms)
3. Remover dependência exclusiva de `isFotoEnviada` para o avanço

Lógica:
```ts
const [uploadedLocally, setUploadedLocally] = useState<Set<string>>(new Set());

useEffect(() => {
  if (prevUploadingRef.current && !uploadingFoto) {
    const uploadedId = prevUploadingRef.current;
    setUploadedLocally(prev => new Set(prev).add(uploadedId));
    
    const timer = setTimeout(() => {
      const isPending = (f: VistoriaFotoConfig) =>
        f.id !== uploadedId && !isFotoEnviada(f.id) && !uploadedLocally.has(f.id);
      
      const nextAfter = fotos.findIndex((f, i) => i > fotoAtualIndex && isPending(f));
      if (nextAfter >= 0) {
        setFotoAtualIndex(nextAfter);
      } else {
        const fromStart = fotos.findIndex(f => isPending(f));
        if (fromStart >= 0) setFotoAtualIndex(fromStart);
      }
    }, 300);
    prevUploadingRef.current = null;
    return () => clearTimeout(timer);
  }
  prevUploadingRef.current = uploadingFoto;
}, [uploadingFoto]);
```

Isso garante que, mesmo que o react-query ainda não tenha atualizado, o componente sabe localmente que aquela foto já foi enviada e avança para a próxima.

## Arquivo

| Arquivo | Acao |
|---|---|
| `src/components/vistorias/VistoriaFotoSequencial.tsx` | Adicionar tracking local de uploads + corrigir auto-avanço |

