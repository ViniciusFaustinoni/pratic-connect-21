
Objetivo: corrigir imediatamente a logo do PDF de cotação para aparecer na cor escura (visível no fundo claro), sem alterar layout/cor dos demais blocos.

Contexto confirmado na base atual:
- O PDF (simples e comparativo) está carregando `'/logos/logo-full-dark.png'` em `src/lib/gerarPdfCotacao.ts` (2 pontos).
- Validação visual dos arquivos públicos mostrou:
  - `logo-full-dark.png` = versão com texto claro (fica “branca” em fundo claro).
  - `logo-full-light.png` = versão com texto escuro (a “logo escura/original” que você quer no PDF claro).
- Portanto, hoje está invertido para o resultado esperado no PDF.

Implementação proposta (rápida e direta):
1) Ajustar a logo no PDF simples
- Arquivo: `src/lib/gerarPdfCotacao.ts`
- Trocar em `gerarPdfCotacao(...)`:
  - de `loadImageWithDimensions('/logos/logo-full-dark.png')`
  - para `loadImageWithDimensions('/logos/logo-full-light.png')`

2) Ajustar a logo no PDF comparativo
- Mesmo arquivo
- Trocar em `gerarPdfCotacaoComparativa(...)`:
  - de `loadImageWithDimensions('/logos/logo-full-dark.png')`
  - para `loadImageWithDimensions('/logos/logo-full-light.png')`

3) (Opcional recomendado para evitar nova confusão de nomes)
- Substituir string literal por constante semântica local, por exemplo:
  - `const LOGO_FOR_LIGHT_BG = '/logos/logo-full-light.png';`
- Usar essa constante nos 2 pontos.
- Não muda comportamento, só reduz risco de regressão futura.

Validação de aceite (fim a fim):
1. Entrar como `admin@teste.com` (senha igual ao e-mail).
2. Ir em `/vendas/cotacoes`.
3. Abrir uma cotação existente e baixar PDF.
4. Confirmar:
   - Logo aparece em cor escura/original.
   - Fundo claro continua no topo/rodapé e área de planos (como já definido).
   - Nenhuma outra cor/estrutura do PDF foi alterada.

Risco e impacto:
- Impacto baixo (apenas troca de asset path em 2 linhas).
- Sem alteração em dados, regras de negócio ou banco.
- Sem impacto em telas web; somente geração do PDF.

Após sua aprovação, aplico essa correção imediatamente.
