## Objetivo

Eliminar a entrada prematura da Troca de Titularidade na fila do Monitoramento. Hoje o card aparece logo após a aprovação do Cadastro, sem fotos. Passa a aparecer somente depois que a vistoria/autovistoria do novo titular for concluída.

## Novo ciclo

```
aguardando_cadastro
  → (cadastro aprova)               → liberada_para_assinatura       (NOVO destino direto)
  → (novo titular assina + paga + faz vistoria/autovistoria)
  → (vistoria concluída no link público) → aguardando_monitoramento  (entra na fila com fotos)
  → (monitoramento aprova ou reprova) → efetivada / cancelada
```

A fila do Monitoramento (`AprovacoesTroca.tsx` aba "Pendentes") passa a representar exatamente o caso "vistoria concluída, aguardando análise das fotos".

## Mudanças

### 1. `supabase/functions/aprovar-troca-cadastro/index.ts`
- Trocar o destino do CAS (linha 72 e 78): `status: 'liberada_para_assinatura'` em vez de `'aguardando_monitoramento'`. CAS continua de `'aguardando_cadastro'`.
- Mensagens de retorno passam a refletir o novo status.
- Mantém todo o background work (snapshot SGA, atribuição de vendedor, WhatsApp).

### 2. Trigger pós-vistoria (SQL migration)
Criar `fn_troca_titularidade_pos_vistoria()` + trigger em `vistorias` (ou `servicos` quando `tipo='vistoria_entrada'` e `origem='troca_titularidade'` muda para `concluida`/`em_analise`):
- Localiza `solicitacoes_troca_titularidade` por `servico_vistoria_id` ou por `veiculo_id` + `efetivada_em IS NULL`.
- Se status atual ∈ (`liberada_para_assinatura`, `aguardando_vistoria`), avança para `aguardando_monitoramento`.
- Idempotente.

### 3. `supabase/functions/contrato-gerar/index.ts` (linhas 1340-1450)
- Já cria o `servico vistoria_entrada` quando aplicável. Sem mudança de lógica — apenas garantir que `solTroca.status` continua válido para o novo fluxo (o gancho atual checava `'aguardando_vistoria'` para antecipar criação; manter como está).

### 4. `supabase/functions/aprovar-troca-monitoramento/index.ts`
- Validação atual: aceita `aguardando_monitoramento` e `aguardando_vistoria`. Manter.
- Remover/ajustar o ramo `solicitar_vistoria` (não faz mais sentido — a vistoria já foi feita quando entra no Monitoramento). Substituir por `reprovar` (devolve para `liberada_para_assinatura` ou cancela). Se preferir, manter `solicitar_vistoria` como reagendamento; combinamos no implementação.

### 5. UI — `src/pages/monitoramento/AprovacoesTroca.tsx` e `src/hooks/useSolicitacoesTroca.ts`
- Atualizar labels: "Pendentes (vistoria concluída)" para a aba pendentes.
- Remover/renomear aba "Em vistoria" se vazia no novo fluxo.
- Botão "Solicitar vistoria" some / vira "Reprovar fotos" conforme decisão acima.

### 6. Backfill (SQL migration)
Para solicitações hoje paradas em `aguardando_monitoramento` SEM vistoria concluída → mover para `liberada_para_assinatura` (idempotente, via WHERE com checagem do `servicos`/`vistorias`).

### 7. Memória
Adicionar `mem://logic/operations/troca-titularidade-monitoramento-pos-vistoria` registrando: "Troca de Titularidade só entra em `aguardando_monitoramento` APÓS vistoria do novo titular concluída. Aprovação de Cadastro vai direto para `liberada_para_assinatura`."

## Pergunta aberta para a implementação

No passo 4, você prefere:
- (a) manter o botão "Solicitar nova vistoria" no card do Monitoramento (devolve para `liberada_para_assinatura` para o novo titular refazer), ou
- (b) substituir por "Reprovar fotos" que cancela a troca?

Posso seguir com (a) por padrão se não responder.
