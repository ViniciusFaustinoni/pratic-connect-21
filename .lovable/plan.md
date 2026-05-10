## Remover Validade do Header e do PDF da Cotação

### 1. `src/components/cotacoes/CotacaoHeader.tsx`
- Remover o `MetricCard` "Válida até / Expirada em" (linhas 141-146).
- Ajustar grid de `sm:grid-cols-3` para `sm:grid-cols-2` (apenas Valor FIPE + Planos Cotados).
- Remover helpers não utilizados: `calcularValidade`, `isExpirada`, variáveis `validade`/`expirada` e import do ícone `Clock` se ficar órfão.

### 2. `src/lib/gerarPdfCotacao.ts` (PDF padrão e comparativo)
- Remover bloco de "Válida até" no cabeçalho do PDF padrão (linhas ~394-408).
- Remover bloco "Barra de validade" no PDF comparativo (linhas ~1133-1149).
- Remover `| Validade: X dias` do rodapé (`footerDate`, linha ~798), deixando só `Gerado em: ...`.
- Remover do `select` da config a coluna `mostrar_validade` e a flag `mostrar_validade` da interface (linhas 12 e 24) — não é mais necessária.
- Manter `validade_dias` nas interfaces `CotacaoParaPdf` (compatibilidade), mas não usar mais.

### 3. `src/components/cotacoes/BotaoGerarPdf.tsx`
- Sem mudanças funcionais necessárias (continua passando `validade_dias`, agora ignorado pelo PDF).

### Fora de escopo
- Não alterar `CotacaoFormDialog.tsx` (campo já foi removido da UI; default `7` permanece internamente, sem impacto visual).
- Não alterar mensagens de WhatsApp/edge functions (não foi pedido).

### Validação
- Abrir o drawer de uma cotação: header mostra apenas Valor FIPE e Planos Cotados, sem "Válida até".
- Gerar PDF (single e comparativo): nenhuma menção a validade no cabeçalho ou rodapé.
