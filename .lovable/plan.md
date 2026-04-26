## Diagnóstico

Hoje, no fluxo de cotação, **5 hooks distintos** consultam a base local Supabase (`associados`/`veiculos`/`cobrancas`) para tomar decisões que precisam vir do SGA Hinova:

| Hook / Arquivo | O que faz hoje (LOCAL) | Onde é usado |
|---|---|---|
| `useVerificarVeiculoAtivoCpf` | Busca associado por CPF + veículo ativo em `associados`/`veiculos` | `EtapaDadosAssociado.tsx` (cotador) |
| `useVerificarVeiculoSGA` | "Verifica SGA" mas na verdade lê `veiculos` local pela placa | `Cotador.tsx`, `CotacaoFormDialog.tsx` (já chama edge `sga-verificar-veiculo`, mas o hook ignora) |
| `useBuscaPlaca` | Busca placa em `veiculos` local + dono | `OutrasEntradasMenu.tsx` (substituição/troca/inclusão) |
| `useAssociadoSearch` | Busca por nome/CPF/telefone em `associados` local | `OutrasEntradasMenu.tsx`, `EtapaDadosAssociado.tsx`, `Cotador.tsx`, `CotacaoFormDialog.tsx` |
| `useVerificarDebitosAssociado` | Soma `cobrancas` com status local (`vencido`/`aguardando_pagamento`) | `DialogTipoOperacao.tsx`, `OutrasEntradasMenu.tsx` |
| `TrocaTitularidadeDialog` | Lê veículos do associado antigo de `veiculos` local | Modal de troca em `OutrasEntradasMenu` |

**Boa notícia:** toda a infra SGA já está pronta em `supabase/functions/_shared/hinova-client.ts`:
- `buscarAssociadoComVeiculosPorCpf(cpf)` — retorna `codigo_associado` + lista `{placa, codigo_veiculo}`
- `buscarVeiculoPorPlaca(placa)` — endpoint primário + fallback, com retry
- `listarBoletosVeiculo(codigo_associado, codigo_veiculo, {anosTras, linkBoleto})` — janelas de 90d, retorna boletos com `link_boleto`/`linha_digitavel`/`nosso_numero`/`valor`/`data_vencimento`/`situacao`
- `hinovaFetch` com auto-reauth em 401/403 (mesma estratégia do sync financeiro recente)

**O que está faltando:**
1. Os hooks acima não passam pela API SGA.
2. Não temos endpoint que receba CPF e devolva, em uma chamada só, **{associado SGA + veículos + situação financeira agregada + boletos abertos com linha digitável}**, que é o que a UI da cotação precisa.

## Solução

### 1. Nova edge function `sga-buscar-associado-completo`

Endpoint único, on-demand, autenticado pelo usuário logado (verify_jwt), que:

**Input:** `{ cpf?: string, placa?: string }` (pelo menos um)

**Fluxo:**
1. Se vier `placa`: `buscarVeiculoPorPlaca` → se achou e tem `cpf_associado`, segue para passo 2 com o CPF retornado.
2. Se vier `cpf`: `buscarAssociadoComVeiculosPorCpf` → `{codigo_associado, veiculos}`.
3. Para cada veículo SGA: `listarBoletosVeiculo(codigo_associado, codigo_veiculo, {anosTras: 3, linkBoleto: true})` em paralelo (já é o padrão da função).
4. Filtrar boletos **em aberto** = `situacao` mapeada por `mapStatusBoleto` em `['pendente','vencido','aguardando_pagamento']` E `data_pagamento` nula.
5. Agregar saldo total devedor por veículo e geral.

**Output** (espelha shape consumido pela UI):
```ts
{
  encontrado: boolean,
  codigo_associado: number | null,
  associado: { nome, cpf, email?, telefone? } | null,
  veiculos: Array<{
    codigo_veiculo: number,
    placa, marca, modelo, ano,
    saldo_devedor: number,
    boletos_abertos: Array<{
      nosso_numero, valor, data_vencimento,
      linha_digitavel, link_boleto, situacao_label
    }>,
  }>,
  saldo_devedor_total: number,
  tem_debito: boolean,
}
```

**Erros:** mesma política `HinovaTransientError`/`HinovaNotFoundError` já usada — 404 = `{encontrado:false}`, transitório = HTTP 503 com `retry_em` para a UI exibir "API SGA temporariamente indisponível, tente em X min" sem bloquear a cotação manualmente.

### 2. Reescrever os hooks para usar a edge function

| Hook | Mudança |
|---|---|
| `useVerificarVeiculoAtivoCpf` | Invoca `sga-buscar-associado-completo` com `{cpf}`. Continua devolvendo `{associado_id, veiculo_id...}` mas agora `*_id` viram `codigo_associado`/`codigo_veiculo` (numéricos do SGA). |
| `useVerificarVeiculoSGA` | Invoca `sga-buscar-associado-completo` com `{placa}`. Já existe edge `sga-verificar-veiculo`, mas ela só diz "existe sim/não". Substituímos por essa nova que dá o pacote completo. Mantemos compatibilidade do retorno atual (`{existe, mensagem}`). |
| `useBuscaPlaca` | Invoca `sga-buscar-associado-completo` com `{placa}` e mapeia para `PlacaSearchResult`. |
| `useVerificarDebitosAssociado` | Recebe **CPF** (não mais `associado_id` local). Invoca a edge e retorna `{temDebito, debitosPorVeiculo, saldoTotal, boletos}`. Cada `DebitoVeiculo` ganha `linha_digitavel` e `link_boleto`. |
| `useAssociadoSearch` | **Mantém híbrido**: continua buscando localmente APENAS para autocomplete por *nome* (SGA não tem busca por nome em string parcial). Para CPF (11 dígitos) passa a chamar a edge SGA primeiro e só cai pro local se SGA não achar (cobre indicadores que ainda não migraram). |

### 3. UI da cotação — exibir aviso de "ex-cliente com débito"

Em `EtapaDadosAssociado.tsx`, quando o CPF digitado retornar `tem_debito === true`:

- Card amarelo de aviso: **"Este CPF já foi cliente Pratic e está com saldo devedor de R$ X,XX (Y boleto(s) em aberto). É necessário quitar antes de prosseguir."**
- Listar cada boleto em aberto com:
  - Vencimento, valor formatado
  - Botão **Copiar linha digitável** (com toast de confirmação)
  - Botão **Abrir boleto** (link `link_boleto` em nova aba)
- Botão **Prosseguir** fica desabilitado se houver débito (mesma regra de bloqueio que já existe em `useInclusaoBloqueioDebito`, agora aplicada também na entrada de cotação nova, não só em inclusão).

`DialogTipoOperacao.tsx` já tem essa UX para inclusão — vamos reaproveitar o mesmo componente visual extraindo `<DebitosCard>` em `src/components/cotacao/DebitosCard.tsx` e usar nos dois lugares.

### 4. TrocaTitularidadeDialog

Substituir a leitura de `veiculos` local pela edge function: ao abrir, busca por CPF do associado antigo no SGA, lista os veículos retornados (placa + marca + modelo + código_veiculo SGA). O `associado_antigo_id` local continua sendo enviado para o backend (pois a tabela `solicitacoes_troca_titularidade` exige FK para `associados`); apenas a fonte do **dropdown de veículos** muda para SGA.

### 5. Mantém o que JÁ funciona

- A edge `sga-verificar-veiculo` antiga (que só diz existe/não-existe) fica deprecada mas viva — `useVerificarVeiculoSGA` migra para a nova; o sync `sga-sync-financeiro-veiculo` continua intocado.
- Feature flag `flag_sga_cotacao_via_api` em `system_settings` (default true) — fallback rápido para a base local caso descubramos algum gap em produção.
- Cache `react-query` com `staleTime: 30s` e `gcTime: 2min` — evita martelar a Hinova quando o usuário digita CPF caractere por caractere; só dispara após CPF completo (11 dígitos), igual hoje.

## Detalhes técnicos

- **Reuso de sessão Hinova**: uma chamada da edge function autentica uma vez via `getHinovaSession` e reusa para todas as chamadas a boletos (paralelismo já implementado em `listarBoletosVeiculo`).
- **Mapeamento de boleto aberto**: `mapStatusBoleto` já existe e converte `situacao` SGA para nossos status. Considerar aberto: `pendente`, `vencido`, `aguardando_pagamento`.
- **CORS**: padrão `_shared` igual outras edge functions.
- **Auth**: `verify_jwt = true` (cotação é tela interna). Validar role do usuário com `check-permission` (qualquer role de vendas + diretor/admin).
- **Logs**: usar `log-edge-function` helper para rastreabilidade — útil para debugar quando o SGA retornar erro intermitente.
- **Sem mexer em**: `useBaseAntiga` (módulo de migração / tela legada de associados sem rastreador, que é trabalho de bastidor, não cotação).

## Resultado esperado

1. Cotação por CPF: aviso claro de débito antigo com boletos copiáveis.
2. Cotação por placa: o sistema reconhece veículo já existente no SGA mesmo que nunca tenha entrado pelo nosso app.
3. Substituição/Troca/Inclusão: parte da mesma fonte de verdade (SGA).
4. Reduz divergências entre nosso banco e o SGA — a base local deixa de ser fonte primária para essas decisões.
