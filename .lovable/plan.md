## Causa

A validação "IMEI ↔ placa" do card **Rastreador instalado (validação)** (tela Aprovação da Troca) em `src/lib/troca-titularidade/validarImeiPorPlaca.ts` só aceita 2 fontes:

1. **Softruck** — busca a placa, lê devices, confirma IMEI entre eles.
2. **Rede Veículos** — só aceita se a edge `rede-veiculos-buscar-dispositivo` retornar `found=true` **E** o `rastreadores.veiculo_id` local já estiver apontando para o veículo da troca.

No caso do **GABRIEL SOUZA DA SILVEIRA** (placa **KPJ4994**, IMEI **354522186314659**):

- Existe rastreador local: `plataforma='rede_veiculos'`, `status='estoque'`, `veiculo_id=NULL` (RAT-20260405104251-CQV).
- A API Rede Veículos `/obterDadosVeiculo/` não retorna o IMEI (está em estoque, sem veículo associado lá).
- A Softruck também não conhece (não é plataforma dela).
- Resultado → `nao_encontrado` ("IMEI não encontrado na Softruck nem na Rede Veículos"), mesmo o sistema já tendo o rastreador cadastrado e identificado como Rede na aba de Rastreadores.

A função `checarConflitoLocal` só usa o registro local para **bloquear** (quando está instalado em outra placa), nunca para **aprovar**.

## Correção (escopo mínimo, só `validarImeiPorPlaca.ts`)

Adicionar uma **camada 0 — estoque local** logo após `checarConflitoLocal`, antes de chamar Softruck/Rede:

```text
SELECT id, veiculo_id, status, plataforma FROM rastreadores WHERE imei = :imei
```

Retorna `{ ok: true, origem, rastreadorId }` quando **todas** as condições baterem:

- registro local existe;
- `plataforma` ∈ {`softruck`, `rede_veiculos`} → define `origem` retornada;
- não há conflito (já tratado por `checarConflitoLocal` na linha 76 — só chegamos aqui se `veiculo_id` é `NULL`, ou igual ao alvo, ou aponta para veículo `cancelado/inativo/vendido`);
- `status` ∈ {`estoque`, `em_estoque`, `disponivel`, `disponível`} OR `veiculo_id === veiculoIdAlvo`.

Comportamento:

- Bloqueios de conflito (`imei_em_outra_placa`) seguem intactos — continuam acontecendo antes da camada nova.
- Se o IMEI não está local, segue o caminho atual: Softruck → Rede → conclusão.
- Tipagem `ValidacaoOrigem` já contempla `'softruck' | 'rede_veiculos'`, sem necessidade de novo valor.
- Log novo: `[VALIDACAO_IMEI_PLACA] estoque_local_ok { imei, plataforma, status }`.

## Fora de escopo

- Nenhuma mudança em `useBuscarRastreadorPorImei`, hooks da Aprovação de Associados, edge functions, DB ou triggers.
- Nenhuma mudança visual no card.
- Não mexer no fluxo Softruck/Rede existente — apenas adicionar a camada local antes.

## Verificação após implementar

1. Reabrir a aprovação do GABRIEL, IMEI `354522186314659` → deve validar OK com origem `rede_veiculos` e liberar o botão Aprovar.
2. Caso de regressão (rastreador instalado em outra placa ativa) → continua bloqueando com `imei_em_outra_placa` (camada `checarConflitoLocal` roda antes).
3. IMEI inexistente → continua caindo em Softruck → Rede → `nao_encontrado`.
