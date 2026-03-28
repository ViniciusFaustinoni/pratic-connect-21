

# Auto-Avanço Imediato Após Envio de Foto

## Problema
O auto-avanço existe no código (linhas 45-67), mas depende de `isFotoEnviada(uploadedFotoId)` retornar `true` após o upload. Há uma condição de corrida: quando `uploadingFoto` volta a `null`, o react-query pode não ter atualizado `fotosEnviadas` ainda, então a condição falha e o avanço não acontece.

## Correção

### `src/components/vistorias/VistoriaFotoSequencial.tsx`

Simplificar o `useEffect` de auto-avanço (linhas 45-67):
- Remover a verificação `if (isFotoEnviada(uploadedFotoId))` — se o upload acabou (era X e agora é null), basta avançar
- Usar o `uploadedFotoId` (foto que acabou de fazer upload) para pular ela na busca da próxima
- Manter a busca: primeiro procurar depois do index atual, depois do início

Lógica simplificada:
```ts
useEffect(() => {
  if (prevUploadingRef.current && !uploadingFoto) {
    const uploadedId = prevUploadingRef.current;
    const timer = setTimeout(() => {
      // Próxima foto que não é a que acabou de enviar e não está enviada
      const nextIndex = fotos.findIndex((f, i) => i > fotoAtualIndex && f.id !== uploadedId && !isFotoEnviada(f.id));
      if (nextIndex >= 0) {
        setFotoAtualIndex(nextIndex);
      } else {
        const fromStart = fotos.findIndex(f => f.id !== uploadedId && !isFotoEnviada(f.id));
        if (fromStart >= 0) setFotoAtualIndex(fromStart);
      }
    }, 600);
    return () => clearTimeout(timer);
  }
  prevUploadingRef.current = uploadingFoto;
}, [uploadingFoto, fotos, fotoAtualIndex, isFotoEnviada]);
```

Isso garante que ao terminar o upload, o sistema avança automaticamente sem o instalador precisar clicar em "Próxima".

| Arquivo | Ação |
|---|---|
| `src/components/vistorias/VistoriaFotoSequencial.tsx` | Corrigir race condition no auto-avanço |

