
# Analista de Eventos: Acesso a Sinistros e Botoes de Acao

## Problema

1. Na tela de listagem de sinistros (`SinistrosList.tsx`), o botao "Analisar" so aparece para `isDiretor` (linha 439). O analista de eventos ve a tabela mas sem botao de acao.
2. Na tela de detalhe/analise (`SinistroAnalise.tsx`), existem botoes "Aprovar Sinistro" e "Reprovar Sinistro" que nao deveriam existir para o analista — ele deve apenas poder analisar, ja que existe um fluxo completo de pre-aprovacao.

## Mudancas

### 1. SinistrosList.tsx — Mostrar botao "Analisar" para o analista de eventos

Na coluna de Acoes (linha 439), trocar `isDiretor` por `isDiretor || isAnalistaEventos` para que o botao de analisar apareca tambem para o analista. Importar `isAnalistaEventos` do hook `usePermissions`.

Tambem aplicar a mesma logica no botao "Enviar para Oficina" (linha 450) — manter apenas para `isDiretor`, ja que o analista nao deve ter essa acao.

### 2. SinistroAnalise.tsx — Remover Aprovar/Recusar para analista

Na pagina de analise do sinistro, o bloco de acoes (linhas 650-686) mostra "Aprovar Sinistro" e "Reprovar Sinistro". Para o analista de eventos:

- Remover os botoes "Aprovar Sinistro" e "Reprovar Sinistro"
- Manter apenas acoes de analise/pre-aprovacao: "Solicitar Documentos", "Abrir Sindicancia"
- O analista pode ver todas as informacoes do sinistro, adicionar observacoes e encaminhar para a diretoria, mas NAO pode aprovar ou reprovar diretamente

A logica sera: os botoes "Aprovar" e "Reprovar" so aparecem quando `isDiretor` for true. Para o analista, exibir uma mensagem informativa como "Analise o sinistro e encaminhe para aprovacao da diretoria".

### 3. SinistrosList.tsx — Botao "Analisar" como acao principal para sinistros novos

Para sinistros com status `comunicado` ou `em_analise`, o botao principal na tabela sera "Analisar" (icone ClipboardCheck) apontando para a rota `/eventos/sinistros/:id/analisar`. Isso ja funciona assim para o diretor, basta estender para o analista.

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/eventos/SinistrosList.tsx` | Adicionar `isAnalistaEventos` na condicao do botao "Analisar" (linha 439) |
| `src/pages/eventos/SinistroAnalise.tsx` | Condicionar botoes Aprovar/Reprovar a `isDiretor` apenas; para analista, mostrar acoes de analise |

## Resultado

- O analista de eventos ve o botao "Analisar" na listagem de sinistros
- Ao clicar, acessa a tela de analise completa com todas as informacoes
- Na analise, pode solicitar documentos, abrir sindicancia, mas NAO pode aprovar ou reprovar
- Apenas o diretor mantem os botoes de Aprovar e Reprovar
