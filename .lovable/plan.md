

# Vídeos 360° lado a lado com expansão ao clicar

## O que muda
Os dois vídeos (Instalador e Associado) passam a ser exibidos **lado a lado** em tamanho reduzido. Ao clicar em qualquer um, ele abre em um **Dialog fullscreen** para visualização ampliada.

## Correção

### Arquivo: `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx`

1. **Layout lado a lado**: Trocar `space-y-4` por `grid grid-cols-1 md:grid-cols-2 gap-4` no container dos vídeos — cada vídeo ocupa metade da largura em desktop.

2. **Vídeos menores**: Reduzir o aspect ratio dos vídeos embutidos (thumbnail compacto) e adicionar `cursor-pointer` + overlay com ícone de expandir.

3. **Estado de expansão**: Adicionar estado `videoExpandido` (`string | null`) que guarda a URL do vídeo clicado.

4. **Dialog de expansão**: Ao clicar no vídeo, abrir um `Dialog` fullscreen com o player em tamanho grande (`max-w-[90vw] aspect-video`), com botão de fechar.

5. **Nos thumbnails**: Os vídeos ficam com `pointer-events-none` nos controles nativos (o clique vai para expandir), e o player ampliado no Dialog terá os controles habilitados.

## Detalhes técnicos

```tsx
// Novo estado
const [videoExpandido, setVideoExpandido] = useState<string | null>(null);

// Grid lado a lado
<CardContent>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {videoInstalador && (
      <div className="space-y-2 cursor-pointer" onClick={() => setVideoExpandido(videoInstalador)}>
        <Badge>Instalador</Badge>
        <div className="relative rounded-lg overflow-hidden border">
          <video src={videoInstalador} className="w-full aspect-video object-contain bg-black" preload="metadata" muted />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30">
            <Expand className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>
    )}
    {/* idem para videoAssociado */}
  </div>
</CardContent>

// Dialog de expansão
<Dialog open={!!videoExpandido} onOpenChange={() => setVideoExpandido(null)}>
  <DialogContent className="max-w-4xl p-0">
    <video src={videoExpandido} controls autoPlay className="w-full aspect-video" />
  </DialogContent>
</Dialog>
```

## Impacto
- 1 arquivo, ~30 linhas alteradas
- Visual mais clean: vídeos compactos lado a lado
- Expansão com um clique para assistir em detalhe

