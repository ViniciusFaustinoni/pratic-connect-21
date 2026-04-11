

## Plano: Incluir todas as fotos da vistoria no laudo PDF

### Problema
O limite atual `MAX_FOTOS_TOTAL = 20` corta 11 das 31 fotos. A linha `sorted.slice(0, MAX_FOTOS_TOTAL)` descarta as excedentes.

### Alteracoes em `supabase/functions/gerar-laudo-vistoria/index.ts`

**1. Aumentar limite de fotos**
- `MAX_FOTOS_TOTAL`: de 20 para 50 (margem para vistorias maiores)

**2. Grid de 3 colunas para fotos menores e organizadas**
- `COLS`: de 2 para 3
- `IMG_WIDTH`: de 240 para 160px
- `IMG_HEIGHT`: de 170 para 115px
- `IMG_GAP`: reduzir para 10px
- Resultado: ~9 fotos por pagina, todas as 31 cabem em ~4 paginas

### Arquivo
- **Editar**: `supabase/functions/gerar-laudo-vistoria/index.ts`
- **Deploy**: edge function `gerar-laudo-vistoria`

