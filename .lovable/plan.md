
## Diagnóstico — KOU6D37

Estado atual no banco:

- `veiculos.status='ativo'`, `cobertura_suspensa=false`, **mas `cobertura_total=false` e `cobertura_roubo_furto=false`** → por isso a UI mostra "Sem Cobertura".
- `rastreadores` (IMEI 869412077334305): `status='instalado'`, `veiculo_id` correto, **mas `associado_id` ainda aponta para o titular antigo** (`9c05d3c4…`, não o novo `de5f0d04…`).
- **Dois contratos `status='ativo'` no mesmo veículo** para o mesmo associado novo:
  - `cad888ca` — `origem_troca_titularidade_id=a5c915b6` (solicitação que ficou `cancelada`; contrato órfão).
  - `a32aefd0` — `origem_troca_titularidade_id=6996a35a` (solicitação `efetivada` em 20:39:35; este é o canônico).

### Causa raiz no código

`supabase/functions/efetivar-troca-titularidade/index.ts` (passo 6, linhas ~427-439):
- Transfere `associado_id` do veículo.
- Limpa `cobertura_suspensa`, `em_troca_titularidade`, `troca_titularidade_id`.
- **Não toca em `cobertura_total` nem `cobertura_roubo_furto`** → o veículo herda o que estava (que neste caso já era `false`, provavelmente porque o titular anterior nunca ativou ou foi limpo em outra etapa).
- **Não atualiza `rastreadores.associado_id`** quando há rastreador instalado.
- **Não cancela contratos `ativo`/`assinado`/`pendente` anteriores do mesmo veículo** vindos de outra `origem_troca_titularidade_id` (a idempotência só olha a própria solicitação).

E o cancelamento de uma solicitação de troca não cascateia para cancelar o contrato que ela tinha criado por antecipação no link público — virou contrato fantasma `cad888ca`.

## Plano de correção

### 1. Saneamento de KOU6D37 (migration)

- `veiculos`: setar `cobertura_total=true`, `cobertura_roubo_furto=true` (veículo tem rastreador instalado e está acima dos R$ 30k → cobertura 360º).
- `rastreadores`: atualizar `associado_id` para o novo titular `de5f0d04-2e69-464d-b681-98e7bc03dfc4`.
- `contratos.cad888ca`: `status='cancelado'`, `data_cancelamento=now()`, motivo "Contrato órfão de solicitação de troca cancelada (a5c915b6) — saneamento".
- Manter `a32aefd0` como contrato canônico ativo.

### 2. Fix em `efetivar-troca-titularidade` (camada estrutural)

Logo após o UPDATE do veículo (passo 6), antes/depois conforme dependência:

- **Religar cobertura**: ler o plano do novo contrato (ou herdar do `contratoAnterior`), e setar em `veiculos`:
  - `cobertura_total=true` quando o plano oferece 360º (carro ≥ R$ 30k, moto ≥ R$ 9k, diesel) **e** há rastreador instalado vinculado.
  - `cobertura_roubo_furto=true` sempre que o plano cobrir R/F.
  - Se não houver rastreador físico em veículos que exigem (Diesel/Carro≥30k/Moto≥9k), respeitar o guard `trg_guard_veiculo_ativo_exige_rastreador` — neste fluxo de troca o rastreador anterior permanece, então o caminho normal é religar.
- **Reatribuir rastreador**: `UPDATE rastreadores SET associado_id=novoAssociadoId WHERE veiculo_id=… AND status='instalado'`.
- **Dedup de contratos órfãos**: antes de criar/atualizar o contrato novo, cancelar contratos `ativo`/`assinado`/`pendente` do mesmo `veiculo_id` cujo `origem_troca_titularidade_id` aponte para uma solicitação `status='cancelada'` ou `'expirada'`. Motivo de cancelamento padronizado.

### 3. Trigger de cancelamento de solicitação (defensivo)

Criar trigger `trg_troca_cancelada_cancela_contrato_orfao` em `solicitacoes_troca_titularidade`: ao mover para `status IN ('cancelada','expirada')`, cancelar qualquer `contratos` ainda em `pendente`/`assinado`/`ativo` vinculado por `origem_troca_titularidade_id`. Evita reincidência do contrato fantasma como `cad888ca`.

### 4. Memória

Atualizar `mem://logic/sales/troca-titularidade-fluxo-canonico-e2e` (existente) e/ou criar leaf nova `mem://logic/operations/troca-titularidade-religa-cobertura-e-rastreador` com a regra:
- Efetivar troca: **transfere veículo + religa cobertura conforme plano + reatribui rastreador + dedup órfãos**. Nenhuma dessas etapas é opcional.

## Detalhes técnicos

Arquivos a editar:

- `supabase/functions/efetivar-troca-titularidade/index.ts` — passo 6 e novo bloco de dedup.
- Migration: saneamento KOU6D37 + criação da trigger defensiva.
- Memória: index.md + leaf.

Ordem de execução (após sua aprovação):
1. Migration de saneamento + trigger.
2. Edge function.
3. Memória.

## Pendências para sua decisão antes de aplicar

1. **Auditoria histórica**: quero rodar a mesma checagem em todas as solicitações `efetivada` recentes para listar quantos outros veículos estão na mesma situação (veículo `ativo` sem `cobertura_total`/`r_f` após troca, ou com rastreador apontando para titular antigo, ou com contrato órfão). Posso rodar agora antes de codificar?
2. **Confirmar saneamento de KOU6D37** conforme item 1 acima (religar cobertura 360º + reatribuir rastreador + cancelar contrato órfão `cad888ca`).
3. **Comunicação ao novo titular Vinicius Faustinoni**: enviar algo ou tratar silenciosamente como correção interna? A mensagem indevida "Proteção 360º ativada" não foi enviada aqui — o problema é o oposto (UI dizendo "Sem Cobertura").

Sem decisão sobre (1) e (2), não codifico.
