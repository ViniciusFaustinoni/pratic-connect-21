

## Plano: Forçar download automático do documento assinado

### Problema
O botão "Baixar Documento Assinado" abre o PDF em uma nova aba (`target="_blank"`) em vez de forçar o download.

### Solução
Substituir o `<a>` por um handler que faz fetch do PDF e dispara download via `blob` + `URL.createObjectURL`.

### Alteração

**`src/components/contratos/ContratoDetailDrawer.tsx`** (linhas 557-564):

Trocar o `<a>` por um `<Button>` com `onClick` que:
1. Faz `fetch(signedFileUrl)`
2. Converte para blob
3. Cria link temporário com `download` attribute e dispara clique

```tsx
{autentiqueStatus.document?.signedFileUrl && (
  <Button
    variant="default"
    size="sm"
    className="w-full"
    onClick={async () => {
      try {
        const res = await fetch(autentiqueStatus.document.signedFileUrl);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contrato-${contrato.numero_contrato || contrato.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        toast.error('Erro ao baixar documento');
      }
    }}
  >
    <FileText className="mr-2 h-3.5 w-3.5" />
    Baixar Documento Assinado
  </Button>
)}
```

