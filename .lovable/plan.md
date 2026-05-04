## Diagnóstico — THAYSSA FALCON (placa TDC6E30)

Comparando o que o associado preencheu (`cotacoes.vistoria_*`) com o que existe nas tabelas operacionais:

| Onde | Endereço | Data | Período |
|------|----------|------|---------|
| **Cotação (escolha real do cliente)** | ESTRADA INTENDENTE MAGALHÃES, 177 — Campinho | 05/05 | tarde |
| `instalacoes` (ativa, id `b18b88b7…`) | R INACIA GERTRUDES, 310 — Parque Anchieta | 04/05 | manhã |
| `servicos` (agendada, id `27db6b9f…`) | R INACIA GERTRUDES, 310 | **09/05** | manhã |
| `instalacoes` cancelada anterior (`1ba3d371…`) | R INACIA GERTRUDES, 310 | 04/05 | manhã |

### Causas raiz

1. **Snapshot estagnado em `instalacoes`** — `criar-instalacao-pos-pagamento` (e `aprovar-proposta`) materializam endereço/data a partir de `cotacoes.vistoria_*` **uma única vez**. Quando o associado depois edita o endereço/data de instalação na cotação, o registro em `instalacoes` (e o `servicos` derivado) **não é re-sincronizado**. Por isso o cadastro/monitoramento ainda exibe o endereço residencial antigo.

2. **`servicos` com data divergente da `instalacao`** — a instalação ativa tem `data_agendada=04/05`, mas o `servicos` espelhado tem `data_agendada=09/05`. Houve reagendamento parcial: alguém moveu o serviço sem atualizar a instalação (ou vice-versa). O resultado é a tela de Monitoramento puxar 09/05 enquanto Cadastro mostra 04/05 — exatamente o "erro que nunca pode acontecer" relatado.

3. **UI de Propostas Pendentes e Aprovação de Instalação** continuam lendo o endereço residencial (`associados.endereco_*`) sem mostrar o endereço de instalação efetivo. Apesar de o último ajuste ter incluído o endereço de instalação na maioria das telas, ele puxa do snapshot da `instalacoes` — que está desatualizado pelo motivo (1).

## Plano de correção

### A. Backend — manter `instalacoes` e `servicos` sempre fiéis à cotação

1. **Trigger `trg_sync_instalacao_from_cotacao`** em `cotacoes` (AFTER UPDATE OF `vistoria_*` / `vistoria_completa_*`):
   - Se existe `instalacoes` com `status NOT IN ('concluida','cancelada')` para a mesma `cotacao_id`, atualiza endereço/data/período/responsável a partir dos campos canônicos da cotação (mesma lógica do `criar-instalacao-pos-pagamento` por `tipo_vistoria`).
   - Em cascata, atualiza o `servicos` ativo (`status IN ('agendada','aguardando_atribuicao','em_rota')`) vinculado via `instalacao_origem_id`, mantendo paridade endereço+data+período.
   - Loga em `instalacao_eventos` a mudança (origem = "edicao_cotacao").

2. **Edge function `sync-instalacao-from-cotacao`** invocável manualmente pelo Cadastro/Monitoramento como botão "Sincronizar com cotação", para casos como o atual e como rede de segurança após backfill.

3. **Garantir `instalacao_origem_id` no `servicos`** — `aprovar-proposta` e demais geradores devem sempre setar esse vínculo (hoje há `servicos` sem ele, o que quebra a sincronização).

### B. Backfill imediato (este caso e demais inconsistentes)

1. **Cancelar instalação `b18b88b7…` e o serviço `27db6b9f…`** (ambos com endereço/data errados) via fluxo padrão (`reagendar`/`cancelar` com motivo "correção endereço/data divergente da cotação").
2. **Recriar instalação** chamando `criar-instalacao-pos-pagamento` com `skipPaymentCheck=true` — agora pegará ESTRADA INTENDENTE MAGALHÃES, 177 / 05/05 tarde da cotação atual.
3. **Query de auditoria** para listar todos os contratos onde `instalacoes` ativa diverge dos campos `vistoria_*` da cotação e de `servicos` ativo — gerar relatório para o Cadastro decidir caso a caso.

### C. Frontend — exibir endereço e data da instalação em todos os pontos

1. **Propostas Pendentes (Cadastro)** — card já mostra "📍 Instalação", mas deve sempre vir da `instalacoes` ativa (não do snapshot da cotação) e exibir um aviso visual quando ela divergir do endereço residencial.
2. **Aba Monitoramento → Aprovação de Associados** — exibir lado-a-lado **Endereço residencial** e **Endereço de instalação**, com data + período da instalação ativa (não do `servicos`, que pode estar dessincronizado até o backfill).
3. **Detalhe da instalação no Monitoramento** — mostrar badge "⚠ Divergência" quando `instalacoes.data_agendada ≠ servicos.data_agendada` ou endereços diferirem; oferece o botão "Sincronizar com cotação" (B.2).

### D. Validação

- Após implantação, reabrir a tela do associado THAYSSA: deve aparecer Estrada Intendente Magalhães, 177 — Campinho, 05/05 tarde tanto em Cadastro quanto em Monitoramento; sem badges de divergência.
- Editar manualmente o endereço de instalação numa cotação de teste e confirmar que `instalacoes` + `servicos` atualizam sozinhos.

## Observações técnicas

- Não toco em `cotacoes.vistoria_*` — é a fonte de verdade.
- A trigger respeita o estado terminal: instalações já concluídas/canceladas nunca são reescritas.
- Não há migração destrutiva — só nova trigger + nova edge function + UI.
- Memória relevante: "Dedupe agendamentos" (uma origem = um agendamento ativo) já cobre o fechamento do `servicos` antigo antes de criar o novo.

Confirma para eu implementar A → C e rodar o backfill da THAYSSA?