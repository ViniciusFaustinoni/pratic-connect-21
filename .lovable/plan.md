## Diagnóstico

A cotação **COT-20260521-154401431-524** (troca de titularidade, placa KOU6D37, novo titular Vinicius Faustinoni) está corretamente:

- `contratos.cad888ca…FZKT7W`: `status=assinado`, `cadastro_aprovado=false`, `tipo_entrada=troca_titularidade`, `origem_troca_titularidade_id` setado.
- `solicitacoes_troca_titularidade.a5c915b6…`: `status=aguardando_cadastro`, termo do antigo titular assinado, novo titular assinou contrato.
- `veiculos.d5181403…` (KOU6D37): `status=ativo` — **vinculado ainda ao titular antigo** (b204ac2b — N0HNLT, contrato ativo). Esse é o estado canônico de uma troca em curso (Memory: `troca-titularidade-desvinculo-logico` + `troca-titularidade-fluxo-canonico-e2e` — só `efetivar-troca-titularidade` muda o `associado_id` do veículo).

A proposta deveria aparecer em /cadastro/propostas com badge "Troca de Titularidade", mas é silenciosamente descartada.

## Causa raiz

Em `src/hooks/usePropostasPendentes.ts` (linhas 606‑625) o gate de saída usa:

```ts
const veiculoJaConcluidoOperacionalmente = veiculoContrato?.status === 'ativo';
...
if (propostaJaConcluida) return null;
```

Para uma **troca de titularidade**, o veículo permanece `ativo` (vinculado ao antigo titular) durante todo o ciclo Cadastro → Monitoramento → `efetivar-troca-titularidade`. Esse filtro foi pensado para fluxo comum (onde `status='ativo'` só acontece DEPOIS do `ativar-associado`), mas em troca ele **mata o item antes mesmo do gate de troca em linha 799-809** que existe justamente para deixar a troca passar sem etapa executada.

O mesmo bug está em `usePropostasPendentesCount.ts` (linha 1646): `setVeiculoAtivo.has(c.veiculo_id)` descarta o item, por isso o contador mostra "Aguardando: 2" em vez de 3.

## Contaminação herdada

Como subproduto do problema anterior (troca cancelada do mesmo veículo), existe um **contrato órfão** `c4f2895f…ZWMOAX` (troca anterior `bb49bf56`, status da troca = `cancelada`) que ficou em `status='assinado'`. A edge `cancelar-troca-titularidade` cancela a **cotação** derivada (linhas 104‑123) mas **não cancela o contrato** derivado quando o novo titular já tinha assinado antes do cancelamento. Esse contrato fantasma ficou escondido pelo mesmo filtro errado — ao corrigir o filtro, ele apareceria duplicado na fila.

## Plano

1. **Corrigir o filtro em `usePropostasPendentes.ts`**
   - Calcular `isTroca` ANTES do gate "concluída" (mover detecção de tipo_entrada/origem_troca_titularidade_id para próximo das linhas 600).
   - Mudar o gate para: `veiculoJaConcluidoOperacionalmente && !isTroca`.
   - Replicar a mesma exceção no contador `usePropostasPendentesCount` (descartar `setVeiculoAtivo` quando o contrato for de troca — buscar também `tipo_entrada` e set de `isTrocaContrato`).

2. **Tampar o vazamento em `cancelar-troca-titularidade/index.ts`**
   - Após cancelar a cotação derivada, cancelar também o contrato vinculado:
     - `UPDATE contratos SET status='cancelado', data_cancelamento=now(), motivo_cancelamento='Troca de titularidade cancelada: …', updated_at=now() WHERE origem_troca_titularidade_id = solicitacao_id AND status NOT IN ('cancelado','ativo')`.
   - Log best-effort, mesma lógica do bloco de cotação.

3. **Saneamento via migration**
   - Marcar `c4f2895f…ZWMOAX` como `cancelado` com motivo "Saneamento: troca de titularidade `bb49bf56` cancelada em 21/05/2026" (não há trigger que dependa disso — é só remover lixo da fila do Cadastro).
   - Verificar se existem outros contratos com `origem_troca_titularidade_id IN (SELECT id FROM solicitacoes_troca_titularidade WHERE status IN ('cancelada','expirada','reprovada')) AND status='assinado'` e aplicar o mesmo cancelamento (deve cobrir só o ZWMOAX, mas a query é segura).

4. **Validação**
   - Recarregar /cadastro/propostas como admin: deve aparecer card da KOU6D37 com badge "Troca de Titularidade", contador "Aguardando: 3", e o fantasma ZWMOAX desaparece (cancelado).
   - Executar a mesma chamada de query no Supabase pra confirmar.

## O que NÃO muda

- Triggers de promoção da troca (`trg_troca_promove_cadastro_via_cotacao`) — a solicitação já está em `aguardando_cadastro` por outro caminho do fluxo.
- Edge `aprovar-troca-cadastro` — continua funcionando assim que o item aparecer na fila e o analista clicar aprovar.
- `usePropostasPendentes` linhas 795‑809 (gate `temQualquerEtapa`) — já trata troca corretamente; a correção é só no gate anterior.
- Edge `efetivar-troca-titularidade` e a flag `veiculos.em_troca_titularidade` — intactas.
