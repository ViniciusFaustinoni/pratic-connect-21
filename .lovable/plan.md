## Problema

Ao clicar em "Criar Cotação de Substituição" no `ModalDetalhesSubstituicao`, o modal navega para `/vendas/cotacoes?tipo_entrada=substituicao&associado_id=...&veiculo_antigo_*=...&solicitacao_substituicao_id=...`, mas em `src/pages/vendas/Cotacoes.tsx` (linhas 269–275) os parâmetros são **descartados** logo após abrir o form. O `CotacaoFormDialog` sobe vazio, sem badge de substituição, sem nome/telefone/email do associado e sem qualquer vínculo com a `solicitacoes_substituicao_placa`.

O knowledge é explícito: "o sistema cria uma cotação no padrão normal aproveitando **nome, email e telefone** do associado … apenas marcada internamente como **Cotação de Substituição**".

## Solução

Espelhar o padrão já existente de `origemTroca` (troca de titularidade) para substituição.

### 1. `src/components/cotacoes/CotacaoFormDialog.tsx`
- Adicionar prop opcional `origemSubstituicao?: { solicitacaoId; associadoId; veiculoAntigoId; veiculoAntigoPlaca; veiculoAntigoModelo }`.
- Quando presente:
  - Forçar `tipoCotacao = 'substituicao_placa'` no estado inicial e desabilitar o `Select` de tipo (igual ao `disabled={!!origemTroca}` da linha 2842).
  - Incluir no payload `tipo_entrada: 'substituicao_placa'` e em `dados_extras`: `solicitacao_substituicao_id`, `veiculo_antigo_id`, `veiculo_antigo_placa`, `veiculo_antigo_modelo` (espelhando o bloco `origemTroca` das linhas 1803–1807).
  - Após `createCotacao` (próximo ao bloco 1985 que vincula a troca), fazer `update` em `solicitacoes_substituicao_placa` setando `cotacao_id = novaCotacao.id` e `status = 'cotacao_criada'`.
- Header do dialog ganha um badge "Substituição de Placa · {placa antiga}" quando `origemSubstituicao` está presente.

### 2. `src/pages/vendas/Cotacoes.tsx`
- No `useEffect` (linhas 250–282), quando `tipoEntrada === 'substituicao'`:
  - Ler também `associado_id`, `veiculo_antigo_id`, `veiculo_antigo_placa`, `veiculo_antigo_modelo`, `solicitacao_substituicao_id`.
  - Guardar em estado local (`substituicaoCtx`) — não limpar a URL antes de o form montar (ou guardar antes de limpar).
- Buscar `nome/email/telefone` do associado (via hook leve baseado em `supabase.from('associados').select(...).eq('id', ...).maybeSingle()` — usar `useAssociado` se já existir, senão `useQuery` inline).
- Passar para `<CotacaoFormDialog>`:
  - `cotacaoBase={{ nome_solicitante, telefone1_solicitante, email_solicitante }}` (campos já suportados — ver linhas 1390–1392).
  - `origemSubstituicao={substituicaoCtx}`.
- Limpar o estado e os params quando o dialog fechar.

### 3. Fora de escopo
- Não criar nova edge function. O update do `cotacao_id` na `solicitacoes_substituicao_placa` é UPDATE simples (a tabela já tem RLS para o operador).
- Não tocar em `efetivar-substituicao`, `enviar-termo-cancelamento-substituicao`, nem no `ModalDetalhesSubstituicao` (já está correto).

## Validação

1. Login como diretor → Cotações → Nova → Substituição → placa `KOU6D37` → modal de detalhes → "Criar Cotação de Substituição".
2. `CotacaoFormDialog` abre com:
   - Badge/título indicando "Substituição de Placa · KOU6D37".
   - Campos Nome / Telefone / Email pré-preenchidos com os dados do associado (editáveis ou não, conforme padrão atual da troca).
   - Select "Tipo da cotação" travado em "Substituição de veículo".
3. Ao salvar, a cotação nasce com `tipo_entrada='substituicao_placa'` e `dados_extras.solicitacao_substituicao_id` populado; `solicitacoes_substituicao_placa.cotacao_id` recebe o novo ID e `status` vira `cotacao_criada`.
4. Reabrir o `ModalDetalhesSubstituicao` mostra o card "Nova Cotação para o veículo substituto" com link para a cotação recém-criada.
