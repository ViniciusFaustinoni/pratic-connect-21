## Diagnóstico — CINTHYA / LPE3902 (Renault Logan 2008, FIPE R$ 17.116 — sub-FIPE)

Estado atual (todos errados para sub-FIPE):

| Entidade | Campo | Valor | Esperado |
|---|---|---|---|
| `associados` (`9d224455`) | `status` | `ativo` | `em_analise` |
|  | `codigo_hinova` | `30031` (no SGA) | — |
| `contratos` (`176a17c4`) | `status` | `ativo` | `assinado` |
|  | `cadastro_aprovado` | `true` (20/04 18:56) | `false` |
|  | `data_ativacao` | `2026-04-20` | `NULL` |
| `veiculos` (`31f320c3`) | `status` | `ativo` | `instalacao_pendente` (na prática: sub-FIPE não tem instalação, mas continua não-ativo até Cadastro+Monitoramento aprovarem) |
|  | `cobertura_roubo_furto` | `true` | `false` (Cadastro libera) |
|  | `cobertura_total` / `cobertura_suspensa` | `false` / `false` | mantém |
|  | `codigo_hinova` | `35792` (no SGA) | — |
| `vistorias` (`13a1033a`) | autovistoria pendente, 3 fotos | — | mantém |
| `servicos` (`25c63b3e`) | `vistoria_entrada` `agendada`, criado hoje 15:55, sem profissional, sem origem (**fantasma do reprocesso de hoje**) | — | reclassificar para `em_analise` com `origem='autovistoria'`, sem profissional, mesma vistoria — assim entra na fila Cadastro |
| `instalacoes` / `rastreadores` | nenhum | — | correto (sub-FIPE não exige) |

A ativação aconteceu em **20/04 18:56** — um mês atrás — pela mesma brecha do KZK1I95 (sub-FIPE + autovistoria enxuta de 3 fotos pulando o Cadastro e indo direto para `ativo`). O reprocesso de hoje 15:55 ainda criou em cima disso um `servicos vistoria_entrada agendada` fantasma.

## Correção (sem mexer em código)

1. `UPDATE associados SET status='em_analise' WHERE id='9d224455...'`
2. `UPDATE contratos SET status='assinado', cadastro_aprovado=false, aprovado_em=NULL, aprovado_por=NULL, data_ativacao=NULL WHERE id='176a17c4...'`
3. `UPDATE veiculos SET status='instalacao_pendente', cobertura_roubo_furto=false WHERE id='31f320c3...'`
4. `UPDATE servicos SET status='em_analise', modalidade='autovistoria', origem='autovistoria_publica', vistoria_origem_id='13a1033a-af40-4be6-8f79-5f11e1bfecfe' WHERE id='25c63b3e...'` (alinha o serviço fantasma à vistoria existente para parar de aparecer como agendamento sem profissional)

Resultado: CINTHYA volta a aparecer em **Cadastro › Propostas/Análise** com a autovistoria enxuta pendente; quando o Cadastro aprovar, R/F é liberado e Monitoramento decide se exige vistoria presencial.

## Avisos importantes (preciso da sua orientação antes de aplicar)

- **SGA Hinova**: associado=30031 e veículo=35792 já foram promovidos a ATIVO no painel desde 20/04. Quer que eu rebaixe para PENDENTE (3) via `alterar-situacao-para` para alinhar?
- **Mensalidades / faturamento**: o contrato está ativo há ~30 dias, com `dia_vencimento=30`. Qualquer mensalidade já emitida/paga neste período permanece como está — esta correção só rebobina o fluxo operacional. Quer que eu liste o que existe em `boletos`/`cobrancas` antes de mexer?
- **Causa raiz**: já apareceu nos 3 casos (KZK1I95, e agora LPE3902). Posso investigar `finalizar-autovistoria-cotacao` para fechar a brecha que deixa sub-FIPE com 3 fotos pular o Cadastro?

Responda "aplica" para rodar a correção do LPE3902, e diga se quer SGA / lista de cobranças / causa raiz junto.
