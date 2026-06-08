## Objetivo

Hoje a tela canônica de aprovação do Cadastro (`/cadastro/propostas/:id` → `PropostaAnalise` → `PropostaDetalhesTabs`) só mostra o lado **novo** (cliente + veículo que estão entrando). Em **Substituição de Veículo** e **Troca de Titularidade**, o analista precisa também ver o lado **antigo** para decidir — exatamente o mesmo conteúdo que existe nos drawers dedicados (`SubstituicaoDetalhePage` e `ModalDetalhesTroca`). O caminho de Processos (Outros Processos) continua existindo, mas o ponto canônico de aprovação passa a ser autossuficiente.

## Escopo (apenas presentation/UI)

Nenhum edge function, nenhuma trigger, nenhum schema de banco muda. Tudo é leitura + renderização no Cadastro.

## Passos

### 1. Extrair "miolo" dos drawers dedicados para componentes reaproveitáveis

- `src/components/substituicao/SubstituicaoDetalheConteudo.tsx` (novo): recebe `solicitacaoId` (ou objeto completo) e renderiza tudo que hoje vive no corpo do `SubstituicaoDetalhePage` — header com veículo antigo × novo, snapshot SGA, status do termo, timeline, agendamentos vinculados, rastreador antigo, observações.
- `src/components/troca-titularidade/TrocaDetalheConteudo.tsx` (novo): mesmo padrão para `ModalDetalhesTroca` — dados do titular antigo (nome, CPF mascarado, telefone, e-mail), contrato anterior, status do termo de cancelamento, snapshot SGA, timeline.
- Os arquivos atuais (`SubstituicaoDetalhePage.tsx` e `ModalDetalhesTroca.tsx`) passam a ser cascas finas que renderizam o componente extraído dentro do layout de página/dialog que já têm.

### 2. Enriquecer `useProposta` com o "processo de origem"

No retorno de `useProposta(contratoId)` (`src/hooks/usePropostasPendentes.ts`), quando o contrato tiver `tipo_entrada` igual a `substituicao_placa` / `substituicao` / `troca_titularidade`, anexar um campo novo `processoOrigem` com a forma:

```ts
processoOrigem?:
  | { tipo: 'substituicao'; solicitacaoId: string }
  | { tipo: 'troca_titularidade'; solicitacaoId: string }
```

A resolução do `solicitacaoId` segue o padrão já usado em outros lugares: ler `cotacoes.dados_extras.solicitacao_substituicao_id` / `dados_extras.solicitacao_troca_id`, com fallback por `veiculo_id`/`associado_id` quando `dados_extras` estiver vazio (mesma estratégia da memória `troca-fallback-antigo-por-veiculo`).

### 3. Adicionar aba condicional no `PropostaDetalhesTabs`

Quando `proposta.processoOrigem` existir, renderizar uma 5ª `TabsTrigger` com label dinâmico ("Substituição" ou "Troca de Titularidade") e ícone. O conteúdo da aba é simplesmente:

- `<SubstituicaoDetalheConteudo solicitacaoId={...} />`, ou
- `<TrocaDetalheConteudo solicitacaoId={...} />`.

O grid das abas passa a ser responsivo (`grid-cols-2 sm:grid-cols-5` quando a aba extra aparece).

### 4. Reforço no header da proposta

No `PropostaHeroHeader`, manter o chip "Substituição de Veículo" / "Troca de Titularidade" já existente (TIPO_ENTRADA_LABEL) e adicionar um pequeno botão âncora "Ver processo" que muda a aba para `processo` (estado controlado via `defaultValue`/`value`).

## Detalhes técnicos

- **Sem duplicação de dados**: o componente extraído faz as próprias queries (`useSubstituicaoVeiculo`, `useSolicitacaoTrocaTitularidade`), igual aos drawers atuais — não precisamos passar nada além do `solicitacaoId`.
- **Sem mexer em aprovação**: gates de sub-etapa 1 (documentos) e sub-etapa 2 (vistoria) continuam idênticos. A aba "Processo" é informativa.
- **Drawers dedicados continuam**: `/cadastro/processos` segue funcional como atalho/visão de fila — só deixou de ser obrigatório para fechar a aprovação.
- **Permissões**: nenhuma RLS muda; o Cadastro já lê `solicitacoes_substituicao_placa` e `solicitacoes_troca_titularidade` nessas telas.

## Arquivos tocados

- `src/components/substituicao/SubstituicaoDetalheConteudo.tsx` (novo)
- `src/components/substituicao/ModalDetalhesSubstituicao.tsx` (usa o novo componente)
- `src/pages/cadastro/SubstituicaoDetalhePage.tsx` (usa o novo componente)
- `src/components/troca-titularidade/TrocaDetalheConteudo.tsx` (novo)
- `src/components/troca-titularidade/ModalDetalhesTroca.tsx` (usa o novo componente)
- `src/hooks/usePropostasPendentes.ts` (campo `processoOrigem` em `useProposta`)
- `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx` (aba condicional)
- `src/components/cadastro/proposta/PropostaHeroHeader.tsx` (botão "Ver processo")

## Fora de escopo

- Unificar/aposentar as filas Processos › Titularidade e Processos › Substituição.
- Mudanças em edge functions, triggers, SGA ou Autentique.
- Saneamento de casos passados — a UI nova aparece em qualquer proposta atual.
