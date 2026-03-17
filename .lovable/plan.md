
Objetivo: fazer o campo “Quem indicou” aparecer no Cotador Rápido e ser salvo junto da cotação.

Diagnóstico
- O Cotador em `src/pages/vendas/Cotador.tsx` não possui nenhum estado nem UI de indicação perto de “Nome do Associado”.
- O fluxo em etapas já tem essa funcionalidade pronta em `src/components/cotacao/EtapaDadosAssociado.tsx`, usando:
  - `Switch`
  - `useAssociadoSearch`
  - busca por nome/telefone/CPF
- O hook `useCriarCotacao` ainda não envia `indicador_id` nem `indicador_nome`.
- A tabela `cotacoes` hoje não possui as colunas `indicador_id` e `indicador_nome` no banco.

Implementação
1. Banco de dados
- Criar migration para adicionar na tabela `cotacoes`:
  - `indicador_id uuid null`
  - `indicador_nome text null`
- Relacionar `indicador_id` com `associados(id)`.

2. Tipagem
- Atualizar `src/types/cotacao.ts`:
  - incluir `indicador_id?: string | null`
  - incluir `indicador_nome?: string | null`
  no `CriarCotacaoPayload`.

3. Persistência
- Atualizar `src/hooks/useCotacao.ts`:
  - incluir os novos campos no `cotacaoData` antes do `.insert(...)`.

4. UI do Cotador
- Atualizar `src/pages/vendas/Cotador.tsx` para adicionar:
  - estado `isIndicacao`
  - estado `indicadorId`
  - estado `indicadorNome`
  - estado `buscaIndicador`
  - uso do hook `useAssociadoSearch(buscaIndicador)`
- Inserir a seção logo abaixo de “Nome do Associado”, reaproveitando o mesmo padrão visual/regra já usado em `EtapaDadosAssociado`:
  - switch “Este cliente foi indicado por um associado?”
  - campo de busca quando ativado
  - seleção do associado indicador
  - botão para limpar seleção

5. Salvamento no fluxo do Cotador
- Em `handleSalvarEEnviarWhatsApp`, enviar `indicador_id` e `indicador_nome` para `criarCotacao.mutateAsync(...)`.

6. Regra de comportamento
- Campo opcional.
- Se o switch for desligado:
  - limpar `indicadorId`
  - limpar `indicadorNome`
  - limpar `buscaIndicador`

Arquivos a alterar
- `src/pages/vendas/Cotador.tsx`
- `src/hooks/useCotacao.ts`
- `src/types/cotacao.ts`
- nova migration em `supabase/migrations/*`

Observação técnica
- Vou seguir exatamente o padrão já existente no fluxo `Cotacao.tsx`/`EtapaDadosAssociado.tsx` para manter consistência de UX e evitar criar uma segunda lógica diferente para indicação.
