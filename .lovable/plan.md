
# Corrigir status exibido para sinistros em analise

## Problema

Quando o analista de eventos envia o link de auto vistoria, o sinistro muda para status `em_analise`. Porem, a pagina de analise exibe **"Sinistro aprovado -- aguardando encaminhamento para oficina"**, o que e incorreto. O status correto a exibir e **"Aguardando auto vistoria"**.

## Solucao

### Arquivo: `src/pages/eventos/SinistroAnalise.tsx` (linhas 788-805)

Separar o tratamento dos status `em_analise` e `aprovado`:

**Status `em_analise`** (link de auto vistoria enviado):
- Exibir banner amarelo/amber: "Aguardando auto vistoria -- link enviado ao associado"
- Nao exibir botao "Enviar para Oficina"
- Opcionalmente exibir botao para reenviar o link

**Status `aprovado`** (sinistro ja aprovado apos vistoria):
- Manter o banner verde atual: "Sinistro aprovado -- aguardando encaminhamento para oficina"
- Manter o botao "Enviar para Oficina"

### Codigo

```typescript
// Status em_analise: aguardando auto vistoria do associado
if (sinistro.status === 'em_analise') {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
        <Clock className="h-4 w-4 flex-shrink-0" />
        <span><strong>Aguardando auto vistoria</strong> -- link enviado ao associado.</span>
      </div>
    </div>
  );
}

// Sinistro aprovado (pos-vistoria)
if (sinistro.status === 'aprovado') {
  return (
    <>
      <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 border border-green-200 text-green-800 text-sm">
        <CheckCircle className="h-4 w-4 flex-shrink-0" />
        <span><strong>Sinistro aprovado</strong> -- aguardando encaminhamento para oficina.</span>
      </div>
      <Button className="w-full" onClick={() => setShowEnviarOficina(true)}>
        <Wrench className="h-4 w-4 mr-2" />
        Enviar para Oficina
      </Button>
    </>
  );
}
```

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/eventos/SinistroAnalise.tsx` | Separar `em_analise` (banner amarelo "Aguardando auto vistoria") de `aprovado` (banner verde com botao oficina) |
