

## Causa
Na aba `Monitoramento → Mapa`, o painel lateral de "Serviços de Campo" (`MapaVistoriasContent.tsx`, linha 1386) está fixado em `w-72` (288 px). Os cards (placa, datas longas, badges como "Arraste no mapa", nomes completos) não cabem nessa largura e são truncados — exatamente o que aparece no print.

## Correção (1 arquivo, 2 linhas)

**`src/components/mapa/MapaVistoriasContent.tsx` (linhas 1384-1387)**

Trocar a largura fixa por uma largura responsiva que cresça em telas maiores e deixar a coluna do mapa absorver o resto:

```tsx
painelAberto 
  ? "w-[22rem] xl:w-[26rem] 2xl:w-[30rem]" 
  : "w-0 border-0 p-0 opacity-0 pointer-events-none"
```

- **Mobile/tablet (<1280 px):** 352 px (w-[22rem]) — +64 px vs. hoje, já resolve os truncamentos do print.
- **Desktop (≥1280 px):** 416 px.
- **Telas grandes (≥1536 px):** 480 px — cards totalmente confortáveis.

O `Card` do mapa ao lado já usa `flex-1`, então se ajusta sozinho.

## Mobile (`MapaMobileContent`)
A versão mobile é renderizada em rota separada (`/instalador/mapa`) e usa drawer/sheet em tela cheia — não é afetada por este ajuste e não precisa de mudança.

## Validação
1. `/monitoramento/mapa` em 1366 px e 1920 px: cards mostram "Arraste no mapa", nomes do associado/instalador e badges sem corte.
2. Botão fechar painel (`ChevronLeft`) e reabrir continuam funcionando.
3. Mapa não fica espremido em nenhum breakpoint (verificar em 1280 px).

## Arquivo a editar
- `src/components/mapa/MapaVistoriasContent.tsx`

