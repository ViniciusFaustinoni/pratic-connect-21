

## Plano: Adicionar logo DT no Termo de Responsabilidade do Rastreador

### O que muda
A seção "Termo de Responsabilidade - Equipamento Rastreador" ganhará um cabeçalho visual com a logo da DT (empresa do rastreador), usando uma barra dourada/amber similar ao design de referência enviado.

### Alterações técnicas

**1. Copiar a logo DT para o projeto**
- `lov-copy user-uploads://LOGO_DT.png public/logos/logo-dt.png`
- A imagem ficará acessível em `https://pratic-connect-21.lovable.app/logos/logo-dt.png`

**2. `supabase/functions/_shared/termo-afiliacao-template.ts`** (~linha 979-983)
- Adicionar um cabeçalho visual antes do título, com barra amber (#D4920B) e a logo DT centralizada (seguindo o layout da imagem de referência)
- Substituir o bloco atual por:
  - Barra dourada com logo DT centralizada (usando `<img>` com URL pública)
  - Título "TERMO DE RESPONSABILIDADE DO RASTREADOR" abaixo da barra
  - Subtítulo "(O preenchimento e a validade deste termo, serão exclusivos para os veículos que possuam rastreador)"

**3. Redeploy** da Edge Function que usa este template (se necessário, pois é shared)

### Escopo
- 1 arquivo de imagem copiado para `public/logos/`
- 1 arquivo de template modificado
- Redeploy das Edge Functions que usam o template

