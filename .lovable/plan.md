

# Corrigir contraste nos cards Resumo e Recomendacao

## Problema
Em dark mode, os textos dos cards "Resumo" e "Recomendacao" herdam cor branca do tema, mas os fundos sao claros (bg-muted/50, bg-red-50, bg-amber-50, bg-green-50), resultando em texto invisivel.

## Solucao

**Arquivo: `src/components/analista-eventos/CardAnaliseRiscoIA.tsx`**

Forcar cores de texto escuras nos elementos dentro de cards com fundo claro:

1. **Resumo (linhas 266-269)**
   - Titulo "Resumo": adicionar `text-gray-900`
   - Paragrafo resumo: trocar `text-muted-foreground` por `text-gray-700`

2. **Recomendacao (linhas 278-280)**
   - Titulo "Recomendacao": adicionar `text-gray-900`
   - Paragrafo recomendacao: adicionar `text-gray-700`

3. **Pontuacao (linhas 222-223)**
   - Numero grande: adicionar `text-gray-900`
   - "/10": trocar `text-muted-foreground` por `text-gray-500`

4. **Labels auxiliares (linhas 227, 241)**
   - "Risco de fraude": trocar `text-muted-foreground` por `text-gray-500`
   - "Fatores analisados": trocar `text-muted-foreground` por `text-gray-500`

Isso garante legibilidade em ambos os temas, ja que os fundos desses cards sao sempre claros.
