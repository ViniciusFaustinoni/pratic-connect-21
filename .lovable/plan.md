

# Redesign UI - Pagina de Cotacoes

Redesign visual da pagina de cotacoes focando em fluidez, intuitividade e experiencia do usuario, sem adicionar ou remover funcionalidades.

---

## 1. Header da Pagina

**Atual:** Titulo + subtitulo + botao "Nova Cotacao" alinhados simples.

**Novo:**
- Header compacto com gradiente sutil no fundo
- Contador total de cotacoes inline no subtitulo ("142 cotacoes no total")
- Botao "Nova Cotacao" com destaque visual (gradiente primario, shadow)

---

## 2. Barra de Status (Stats Bar)

**Atual:** Cards horizontais com scroll, todos com mesmo peso visual, dentro de um Card com borda.

**Novo:**
- Remover o Card wrapper -- pills flutuantes diretas
- Cada pill com hover interativo e cursor pointer
- Pill do status ativo (com cotacoes) ganha destaque sutil (borda colorida inferior)
- Pills com contagem zero ficam com opacidade reduzida
- Transicao suave no hover (scale + shadow)
- Icone e numero na mesma linha para compactar

---

## 3. Filtros

**Atual:** Filtros em flex-wrap com selects padrao, visual generico.

**Novo:**
- Agrupar filtros em uma unica barra com fundo sutil (bg-muted/30 rounded-xl)
- Input de busca com borda arredondada e icone mais visivel
- Selects com estilo mais limpo (sem borda visivel, apenas underline ou ghost)
- Botao "Limpar filtros" aparece apenas quando ha filtros ativos, com animacao fade-in
- Indicador visual de quantos filtros estao ativos (badge numerica)

---

## 4. Tabela de Cotacoes (CotacoesTable)

**Atual:** Tabela HTML padrao com alternancia de cor sutil. Badges de status pequenos. Informacoes condensadas.

**Novo:**
- Manter estrutura de tabela (nao trocar por cards -- a tabela funciona bem para scan rapido neste contexto)
- **Linhas com borda lateral colorida** por status (4px left border: amarelo=rascunho, azul=enviada, verde=aceita, etc)
- **Hover mais expressivo**: bg-primary/8 + shadow-sm + leve translate-x (2px) para dar sensacao de profundidade
- **Badge de status maior e mais legivel**: padding aumentado, font-size 11px, border-radius pill
- **Etapa da venda com icone de progresso**: em vez de badge empilhado, usar um chip inline ao lado do status com icone de seta
- **Coluna Cliente**: Avatar com gradiente de cor baseado na inicial, nome em bold, telefone com link clicavel (tel:)
- **Coluna Veiculo**: Placa em destaque (font-mono, bg-muted, rounded) separada do modelo
- **Coluna FIPE**: Valor com formatacao mais destaque (font-semibold, cor primaria)
- **Coluna Data**: Usar "Hoje", "Ontem" para datas recentes em vez de formato relativo generico
- **Acoes**: Botoes com tooltip, icones maiores (h-4 w-4), espacamento melhor
- **Linha selecionada/hover**: efeito de elevacao com ring sutil

---

## 5. Estado Vazio

**Atual:** Icone + 2 linhas de texto centralizado.

**Novo:**
- Ilustracao mais rica (icone maior com circulo de fundo gradiente)
- CTA "Nova Cotacao" direto no estado vazio
- Texto mais amigavel

---

## 6. Hint de Clique

**Atual:** Texto simples abaixo da tabela.

**Novo:** Remover -- o hover expressivo nas linhas ja comunica que sao clicaveis.

---

## Arquivos alterados

1. `src/pages/vendas/Cotacoes.tsx` -- Header, stats bar, filtros, hint
2. `src/components/cotacoes/CotacoesTable.tsx` -- Visual da tabela, hover, bordas, badges

## O que NAO muda
- Logica de negocio (filtros, ordenacao, acoes)
- Hooks e queries
- Modais (detalhes, form, email, contrato wizard)
- Funcoes de WhatsApp/PDF/duplicar/excluir

