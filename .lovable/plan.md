

# Redesign: Gestao Comercial — Navegacao Intuitiva com Guias Didaticos

## Problema atual
- 9 abas horizontais comprimidas em uma linha, dificil de ler e navegar
- Sem explicacao do que cada secao faz — usuario precisa adivinhar
- Layout plano sem hierarquia visual entre secoes relacionadas

## Solucao

Substituir a barra de abas horizontal por um layout de **sidebar lateral com categorias agrupadas** e descricoes curtas em cada item. A sidebar organiza as 9 secoes em 3 grupos logicos, cada item com subtitulo explicativo. O conteudo principal ocupa o restante da tela.

### Agrupamento proposto

**Produtos e Precos** (icone de loja)
- Planos, Produtos e Precos — "Crie e edite planos, vincule linhas e defina precos por faixa FIPE"
- Beneficios e Coberturas — "Gerencie os beneficios exibidos nos cards e coberturas de marketing"
- Adicionais — "Configure beneficios adicionais opcionais com valor extra"

**Financeiro e Rateio** (icone de calculadora)
- Simulador de Rateio — "Simule a distribuicao de custos entre associados"
- Configuracao do Rateio — "Defina os parametros e regras do calculo de rateio"

**Regras e Operacao** (icone de engrenagem)
- Elegibilidade — "Defina quais veiculos (marca, modelo, ano) cada plano aceita"
- Regras de Venda — "Configure limites FIPE, comissoes e taxas administrativas"
- Instalacao e Rotas — "Gerencie pontos de instalacao e rotas de atendimento"
- Mapa de Atendimento — "Visualize a cobertura geografica de atendimento"

### Alteracoes

| Arquivo | Acao |
|---------|------|
| `src/components/gestao-comercial/TabNavigation.tsx` | **Reescrever** — Substituir abas horizontais por sidebar vertical com grupos, icones, descricoes e estado ativo destacado |
| `src/pages/diretoria/GestaoComercial.tsx` | **Alterar** — Trocar layout de `space-y-6` para `flex` com sidebar (w-72) + area de conteudo. Adicionar banner contextual no topo da area de conteudo com titulo e descricao da secao ativa |
| `src/components/gestao-comercial/PageHeader.tsx` | **Manter** — KPIs continuam no topo, acima do layout sidebar+conteudo |

### Detalhes da sidebar

- Largura fixa `w-72`, fundo `bg-card`, borda direita
- Cada grupo tem titulo em `uppercase text-xs text-muted-foreground`
- Cada item: icone + label + descricao em `text-xs text-muted-foreground`
- Item ativo: fundo `bg-accent`, borda lateral esquerda colorida
- Responsivo: em telas menores (`lg:hidden`), colapsa para um dropdown/sheet como ja existe no `ConfiguracoesMobileNav`

### Banner contextual

Acima do conteudo de cada secao, um bloco com:
- Titulo da secao ativa (h2)
- Descricao expandida de 1-2 frases explicando o que fazer ali
- Separador visual antes do conteudo real

Nenhuma funcionalidade sera removida — apenas a navegacao e a apresentacao mudam.

