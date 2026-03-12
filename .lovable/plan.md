

# Melhorar UI do Resumo Global de Elegibilidade

## Problema
A tabela do Resumo Global tem visual pobre: fundo amarelo nas linhas sem configuração, badges amarelos pouco legíveis, sem hierarquia visual, números sem destaque, e visual genérico que não diferencia estados.

## Mudanças propostas

### Arquivo: `src/components/gestao-comercial/ElegibilidadeVeiculos.tsx` — função `TabResumoGlobal`

**1. Envolver a tabela em um Card com header**
- Card com título "Resumo Global" e subtítulo com total de planos configurados vs não configurados

**2. Melhorar a tabela visualmente**
- Remover `bg-yellow-50` das linhas sem configuração — usar `opacity-60` sutil
- Badge "Sem configuração" → variante `secondary` com cor neutra (cinza) ao invés de amarelo gritante
- Números de Aceitos/Limitados/Negados com cores semânticas inline: verde, amarelo, vermelho (texto colorido, não badge)
- Coluna Total com `font-semibold`
- Linha com dados configurados: sutil highlight no hover

**3. Adicionar indicadores visuais nos números**
- Aceitos: `text-green-600 font-medium`
- Limitados: `text-amber-600 font-medium`
- Negados: `text-red-600 font-medium`
- Zero exibido como "—" em cor muted ao invés de "0"

**4. Melhorar badge de Linha**
- Usar cores diferentes por linha (select=blue, especial=orange, lancamento=purple, advanced=red) com `variant="secondary"` e background suave

**5. Adicionar mini barra de progresso visual**
- Uma barra horizontal empilhada (verde/amarelo/vermelho) proporcional ao total, ao lado dos números, mostrando a distribuição visual de aceitos/limitados/negados

**6. Loading state**
- Skeleton rows ao invés de texto simples "Carregando..."

