

# Exibir Miniatura do Video do Regulador na Tela do Analista de Eventos

## Problema

Na pagina de analise do analista de eventos (`EventoAnaliseDetalhe.tsx`), o video do regulador esta sendo exibido apenas como um tag `<video controls>` simples dentro de um accordion. Isso pode nao estar renderizando corretamente em todos os dispositivos ou o video pode nao estar aparecendo de forma visivel/destaque.

## Solucao

Melhorar a exibicao do video na secao "Vistoria do Regulador" do analista, adicionando:
1. Um player de video com thumbnail visivel (poster/preview)
2. Label mais destacado ("Video do Regulador")
3. Estilo visual consistente com o restante da interface (card com borda, fundo escuro)

## Alteracoes

### Arquivo: `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx`

Substituir o bloco de video nas linhas 391-396 por um componente mais robusto:

**De:**
```tsx
{dadosVistoria?.video_url && (
  <div>
    <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1"><Video className="h-3 w-3" /> Vídeo</p>
    <video controls className="w-full rounded-lg" src={dadosVistoria.video_url} />
  </div>
)}
```

**Para:**
```tsx
{dadosVistoria?.video_url && (
  <div className="space-y-1">
    <p className="text-sm font-semibold flex items-center gap-1">
      <Video className="h-4 w-4 text-purple-500" /> Vídeo do Regulador
    </p>
    <div className="rounded-lg overflow-hidden border border-border bg-black">
      <video
        controls
        playsInline
        preload="metadata"
        className="w-full aspect-video object-contain"
        src={dadosVistoria.video_url}
      >
        Seu navegador não suporta a reprodução de vídeos.
      </video>
    </div>
  </div>
)}
```

Principais melhorias:
- `preload="metadata"` forca o navegador a carregar o primeiro frame (miniatura)
- `playsInline` garante compatibilidade mobile
- `aspect-video` garante proporcao consistente
- Label mais visivel com icone roxo
- Fundo preto e borda para destaque visual

