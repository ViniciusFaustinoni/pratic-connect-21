## Contexto

Hoje uma Troca de Titularidade gera corretamente uma cotação avulsa, com **todos os campos do cliente já preenchidos** no banco (`nome_solicitante`, `cliente_cpf`, `email_solicitante`, `telefone1_solicitante`) e do veículo (placa, marca, modelo, ano, cor, FIPE). Mesmo assim, a tela de detalhe (1ª screenshot) mostra "Cotação avulsa — Vincule a um lead para enviar" porque o card só lê de `cotacao.leads.*`.

Além disso, a mesma cotação pode ser exibida de duas maneiras diferentes:

- `CotacaoDetalhesModal` (drawer aberto ao clicar na linha — 3ª screenshot)
- `CotacaoDetalhe` (rota `/vendas/cotacoes/:id` — 1ª screenshot)

Ambos mostram cabeçalho, cliente, veículo, valores, ações; o modal é uma versão reduzida e desatualizada da página. Isso é a "duplicidade de áreas".

## Objetivos

1. Toda cotação (avulsa, lead, troca de titularidade) é vista pela mesma tela: a página `/vendas/cotacoes/:id`.
2. Quando não há lead, o card Cliente exibe os dados do solicitante salvos na própria cotação (nome, CPF, telefone, e-mail), com botões Ligar/WhatsApp já habilitados.
3. Cotações de Troca de Titularidade ganham um badge claro no header e a mensagem "Cotação avulsa - Vincule a um lead para enviar" deixa de aparecer quando os dados do solicitante já existem.

## Mudanças

### 1. Remover o modal duplicado (`CotacaoDetalhesModal`)

- `src/pages/vendas/Cotacoes.tsx`
  - `handleRowClick` passa a `navigate(`/vendas/cotacoes/${cotacao.id}`)` em vez de abrir modal.
  - Remover estado `showDetalhesModal`, `setShowDetalhesModal`, o bloco JSX `<CotacaoDetalhesModal …>` e o lazy import.
  - `handleContinuarCotacao` deixa de fechar o modal (não existe mais) e segue abrindo `CotacaoFormDialog`.
- `src/components/cotacoes/CotacaoDetalhesModal.tsx`: arquivo é deletado (nenhum outro consumer — `rg` confirma).
- `CotacaoCard` / `CotacoesMobileList` / `CotacoesTable`: garantir que o clique e o item "Ver detalhes" do menu também navegam para a página.

### 2. Card Cliente: usar dados do solicitante quando não há lead

`src/components/cotacoes/CotacaoClienteVeiculo.tsx`

- Adicionar nas props os campos opcionais `nome_solicitante`, `cliente_cpf`, `email_solicitante`, `telefone1_solicitante`, e `tipo_entrada` (de `dados_extras.tipo_entrada`).
- Lógica de renderização:
  - Se `lead_id` existir → mantém comportamento atual.
  - Senão, se `nome_solicitante` existir → renderiza o mesmo layout (Nome, telefone, e-mail, botões Ligar/WhatsApp), com um badge "Solicitante (cotação avulsa)" e ação secundária `Vincular Lead` permanece disponível como link discreto.
  - Senão (sem lead e sem solicitante) → mantém o estado vazio atual.
- O `Alert` "Cotação avulsa — Vincule a um lead para habilitar envio" só aparece quando NÃO há nem lead nem solicitante.

`src/pages/vendas/CotacaoDetalhe.tsx`

- Passar os novos campos para `<CotacaoClienteVeiculo … />`.

### 3. Indicar Troca de Titularidade no header

`src/pages/vendas/CotacaoDetalhe.tsx`

- Quando `cotacao.dados_extras?.tipo_entrada === 'troca_titularidade'`, renderizar o `<TrocaTitularidadeBadge />` (componente já existe) ao lado do título dentro de `CotacaoHeader` (ou logo abaixo).

### 4. Não-mudanças (fora de escopo)

- Sem alteração no edge `criar-solicitacao-troca-titularidade` — a cotação já é criada com os campos certos.
- Sem alteração em `CotacaoFormDialog` / fluxo de criação rápida.
- Sem alteração em RLS, schema ou no fluxo de aprovação da troca.

## Critérios de aceite

1. Ao clicar em qualquer linha de `/vendas/cotacoes`, o usuário cai em `/vendas/cotacoes/:id` (sem drawer).
2. Em uma cotação criada por Troca de Titularidade:
   - Card Cliente exibe nome do novo titular, CPF, telefone e e-mail (com botões Ligar e WhatsApp ativos).
   - Header mostra o badge "Troca de Titularidade".
   - Mensagem "Vincule a um lead" desaparece.
3. Cotações realmente avulsas (sem nome do solicitante e sem lead) continuam mostrando o estado vazio + CTA "Vincular Lead".
4. Nenhum import quebrado: `CotacaoDetalhesModal` é removido por completo.
