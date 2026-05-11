# Forçar PENDENTE no veículo após cadastro no SGA

## Situação atual

- O cadastro de veículo (`sga-hinova-sync` → `cadastrarVeiculoHinova`) já envia `codigo_situacao = 3 (PENDENTE)` no payload, mas **não há uma confirmação explícita** após o cadastro — diferente do que já fazemos para o associado, onde existe `alterarSituacaoAssociadoHinova` (GET `/associado/alterar-situacao-para/:cod_situacao/:cod_associado`) chamado logo após o cadastro para garantir PENDENTE.
- Existe um helper `alterarSituacaoVeiculoHinova` em `supabase/functions/_shared/hinova-client.ts` (linha 1114), mas ele usa **POST** em vários paths candidatos (`/veiculo/alterar/situacao`, etc.) — não é o endpoint que o Hinova documenta agora.
- O endpoint correto informado pelo usuário é GET `/veiculo/alterar-situacao-para/:codigo_situacao/:codigo_veiculo` (mesma família de `alterar-situacao-para` já usada para associado).

## O que será feito

### 1. Novo helper GET no `hinova-client.ts`

Adicionar `alterarSituacaoParaVeiculoHinova(supabase, codigo_veiculo, codigo_situacao)` espelhando o helper já existente para associado (linha 1155):

```
GET {apiUrl}/veiculo/alterar-situacao-para/{codigo_situacao}/{codigo_veiculo}
Authorization: Bearer {token}
```

Retorno padrão `{ ok, status, raw, mensagem, errors }`. O helper antigo (POST) fica marcado como deprecated mas não será removido ainda (para evitar mexer no efetivar-troca-titularidade nesta task — ver "Fora de escopo").

### 2. Disparo automático em `sga-hinova-sync/index.ts`

Logo após `cadastrarVeiculoHinova` retornar `ok` e `codigoVeiculoHinova` (linhas 901–929), chamar:

```
alterarSituacaoParaVeiculoHinova(supabase, codigoVeiculoHinova, 3)
```

Comportamento:
- Sempre executa quando o veículo acabou de ser cadastrado (cenário "veículo novo enviado ao SGA"), independente do `statusDestino`.
- Loga via `logSync(_vid, _aid, 'alterar_situacao_veiculo', ok ? 'success' : 'warning', { codigo_veiculo, codigo_situacao: 3 }, raw, ok ? null : detalhe)`.
- **Não interrompe a sync** se falhar — o veículo já foi criado com situação PENDENTE no payload de cadastro; este passo é uma confirmação defensiva (mesma postura que temos para o associado).
- Não roda quando o veículo já existia no Hinova (`veiculoJaExistiaNoHinova=true`) — coerente com a regra de não reescrever situação de veículos já gerenciados manualmente.

### 3. Atualizar memória

Atualizar o item já existente `mem://logic/operations/sga-renavam-opcional-zero-km`/Core para refletir que **o sistema agora também executa `alterar-situacao-para/3` no veículo** (não só no associado). O Core já diz "Cadastro força PENDENTE (3) via alterar-situacao-para" — vou tornar explícito que isso vale para associado **e** veículo.

## Fora de escopo

- Não vou trocar as duas chamadas existentes de `alterarSituacaoVeiculoHinova` no `efetivar-troca-titularidade` (cancelamento do veículo antigo). Elas usam código de cancelamento, não PENDENTE, e o pedido foi específico para o cadastro. Posso migrar depois em task separada.
- Não vou remover o helper POST antigo nesta task.
- Sem mudanças de schema, RLS ou frontend.

## Arquivos afetados

- `supabase/functions/_shared/hinova-client.ts` — novo helper.
- `supabase/functions/sga-hinova-sync/index.ts` — chamada pós-cadastro + log.
- `mem://index.md` (Core) — ajuste textual.
