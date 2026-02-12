

# Novo Layout HTML para Documentos Gerados

## Objetivo
Redesenhar o CSS e a estrutura HTML do cabecalho e estilos globais do documento gerado, sem alterar a logica de conteudo (variaveis, aditivos, etc.). O layout deve seguir o padrao visual das imagens de referencia:

- Cabecalho com barra gradiente vermelho-para-azul e logo centralizado
- Secoes de dados com barra de titulo escura (fundo escuro, texto branco)
- Campos organizados em grid com bordas tipo tabela
- Corpo do texto justificado com formatacao limpa

## Alteracoes

### Arquivo unico: `supabase/functions/_shared/template-utils.ts`

#### 1. Redesenhar `generateStyles()`

Substituir os estilos CSS atuais por um layout que replica o documento de referencia:

- **Header**: Barra com gradiente linear de vermelho (#c41e3a) para azul escuro (#1a1a6e), logo centralizado sobre ela, e dados da empresa abaixo
- **Section titles**: Barras escuras (background #1a1a6e) com texto branco centralizado, estilo tabela (ex: "DADOS DA ASSOCIACAO", "DADOS DO VEICULO")
- **Tabelas de dados**: Campos com bordas 1px solid, labels em bold, layout grid de 2 ou 3 colunas
- **Corpo de texto**: Fonte 10pt, line-height 1.4, text-align justify, paragrafos com margem inferior 10pt
- **Subsecoes**: Titulos com borda inferior e estilo tipo "CONSIDERACOES INICIAIS" (centralizado, com bordas acima e abaixo)

#### 2. Redesenhar `generateHeader()`

Estrutura atualizada:
- Div com gradiente vermelho-azul como barra de topo (height ~40px)
- Logo centralizado no topo (sobre ou logo abaixo do gradiente)
- Abaixo: titulo "TERMO DE AFILIACAO AO PROGRAMA DE SOCORRO MUTUO" e numero do contrato
- Remover o estilo anterior de texto simples com borda inferior azul

#### 3. Ajustar estilos de tabelas HTML do TipTap

Garantir que `<table>` vindas do TipTap herdem estilos visiveis:
- Bordas visiveis nas celulas
- Cabecalho de tabela com fundo escuro e texto branco
- Padding consistente nas celulas

### Nao sera alterado
- `criarMapeamentoVariaveis()` - sem mudancas
- `substituirVariaveis()` - sem mudancas
- `markdownParaHTML()` - sem mudancas
- `buscarEGerarAditivos()` - sem mudancas
- `generateSecaoAssinatura()` - apenas ajuste de estilo via CSS, sem mudanca de estrutura
- `generateFooter()` - sem mudanca estrutural

### Deploy
- `autentique-create`
- `autentique-create-by-token`

