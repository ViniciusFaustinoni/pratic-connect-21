---
name: fluxo-cotacao-ativacao
description: Mapa canônico do fluxo de uma cotação até a ativação do associado neste projeto (Praticcar). Use ao mexer em qualquer etapa entre criação da cotação e ativação — link público, contrato, autovistoria, instalação, Cadastro, Monitoramento, ativar-associado, sync SGA — ou ao diagnosticar travas no funil (status_contratacao, cadastro_aprovado, veiculos.status, status_contratacao=ativo). Triggers: "fluxo de cotação", "ativação", "cadastro aprovado", "aprovar-proposta", "ativar-associado", "propostas pendentes", "aguardando aprovação", "troca de titularidade", "substituição de placa", "sub-FIPE", "autovistoria", "instalação", "Monitoramento aprovou mas...", "veículo travado em instalacao_pendente", "cotação travada em".
---

# Fluxo Cotação → Ativação (Praticcar)

Este projeto tem **um caminho único** da cotação até a ativação. O que muda entre os 4 fluxos (Comum, Troca, Sub-FIPE, Substituição) são as **exigências** dentro desse caminho, não a estrutura. Antes de alterar qualquer etapa, leia esta skill inteira — ela existe porque cada tentativa anterior de "atalho" gerou guard de DB em cima.

## Quando usar

- Criar/alterar edge functions em `supabase/functions/` cujo nome contenha `cotacao`, `contrato`, `proposta`, `troca`, `substituicao`, `autovistoria`, `instalacao`, `monitoramento`, `cadastro`, `ativar-associado`.
- Diagnosticar caso real: cotação travada, contrato sem virar ativo, veículo preso em `instalacao_pendente`, fila do Cadastro recebendo coisa que não devia.
- Mudar qualquer trigger ou função SQL com prefixo `trg_guard_*`, `fn_reconciliar_*`, `recompute_cotacao_status_contratacao`, `fn_reativar_cobertura_pos_instalacao`.
- Tocar em `cotacoes.status_contratacao`, `contratos.cadastro_aprovado`, `contratos.aprovado_em`, `contratos.status`, `veiculos.status`, `solicitacoes_troca_titularidade.status`.

## Invariantes não-negociáveis

Estes não são preferências — são guards de DB ou edges que vão **bloquear** o request se violados. Não tente contornar.

1. **`ativar-associado` é o único caminho** para gravar `status='ativo'` em `associados`, `contratos`, `veiculos`. Nunca faça `UPDATE ... SET status='ativo'` direto. Guard: `trg_guard_cotacao_ativo_exige_caminho_canonico` (BEFORE UPDATE em `cotacoes`) e `trg_guard_veiculo_ativo_exige_rastreador`. Razão: sem o lock + CAS + log do edge, dá pra ativar um veículo Diesel/FIPE-alta sem rastreador, que depois explode no sinistro.
2. **Cadastro nunca recebe contrato com `cadastro_aprovado=true`.** Trigger `trg_protege_cadastro_aprovado` impede regressão. Auto-promoção de `cadastro_aprovado` é **exclusiva** de vistoria presencial técnica concluída — autovistoria do cliente JAMAIS dispara (`trg_servico_promove_cadastro` e `trg_agendamento_base_promove_cadastro` filtram por `modalidade != 'autovistoria'`).
3. **Cadastro avalia apenas:** (a) documentos sempre, (b) autovistoria enxuta acima FIPE (2 fotos + vídeo 360°). Sub-FIPE completa e presencial técnica vão direto pro Monitoramento. Fonte única de verdade: `src/lib/cadastro/escopoAnaliseCadastro.ts`. Guard no edge `aprovar-proposta`. Três guards DB blindam o pipe Cadastro→R/F: `trg_guard_instalacao_concluida_exige_cadastro_aprovado`, `trg_guard_servico_autovistoria_concluida`, `trg_guard_cobertura_rf_exige_decisao_cadastro`.
4. **Rastreador obrigatório:** Diesel (qualquer), Carro FIPE ≥ R$ 30k, Moto FIPE ≥ R$ 9k. `instalacoes.dispensa_rastreador=true` nesses casos é PROIBIDO (`trg_guard_dispensa_rastreador_coerente`). Ativar veículo desses sem rastreador físico vinculado retorna 409 `requer_rastreador_fisico` em `ativar-associado`.
5. **Toda instalação concluída** (Base, Rota, Autovistoria acima-FIPE, Prestador) passa **obrigatoriamente** pela fila Monitoramento › Aprovações › Aprovação de Associados. Triggers de pós-instalação NÃO ativam cobertura nem promovem veículo a `ativo` — só religam cobertura suspensa por timeout 48h.
6. **Aprovação de autovistoria nunca fecha `instalacoes`** nem `servicos.tipo='instalacao'`. Só vistoria presencial do técnico fecha instalação. Guard: `trg_guard_instalacao_concluida_exige_rastreador`.
7. **`cotacoes.status_contratacao='ativo'`** exige o caminho canônico inteiro do veículo: `contratos.cadastro_aprovado=true` + `aprovado_em IS NOT NULL` + `contratos.status='ativo'` + `veiculos.status='ativo'`. `associados.status` é ruído nesse cálculo — foi removido do `recompute_cotacao_status_contratacao`. Guard: `trg_guard_cotacao_ativo_exige_caminho_canonico`.
8. **SGA Hinova nunca recebe situação ATIVO do sistema.** Cadastro força PENDENTE (3) via `alterar-situacao-para` tanto para associado quanto para veículo logo após o cadastro. Promoção a ATIVO é manual no painel SGA.

## As 8 etapas canônicas

Sequência obrigatória, sem pulos. Cada etapa lê estado da anterior — pular gera órfão ou trava reconciliação.

```text
1. Cotação criada
   └── cotacoes: status='enviada', status_contratacao='plano_escolhido'

2. Cliente avança no link público
   └── escolhe plano, envia docs, assina termo, paga (se houver)
   └── cotacoes.status_contratacao evolui: plano_escolhido → documentos_enviados
       → termo_assinado → pagamento_ok

3. (Opcional/obrigatório conforme FIPE) Autovistoria
   ├── Acima FIPE: opcional, ENXUTA (motor + chassi + vídeo 360° painel ligado)
   └── Abaixo FIPE (sub-FIPE): OBRIGATÓRIA, COMPLETA (31 carro / 15 moto + vídeo)

4. Agendamento (instalação ou vistoria base)
   └── criar-instalacao-pos-pagamento cria instalacoes status='agendada'
       quando cliente agenda — SEM depender de cadastro_aprovado
   └── Data = data do agendamento do cliente. NUNCA default=hoje.

5. Cadastro aprova documentos (manual, fila Propostas Pendentes)
   └── aprovar-proposta seta contratos.cadastro_aprovado=true, aprovado_em=now()
   └── Promove cotacao.status_contratacao → aguardando_aprovacao_monitoramento
       OU aguardando_instalacao (se autovistoria opcional acima-FIPE sem instalação física)

6. Vistoria/instalação presencial executada
   └── técnico conclui em campo
   └── trigger trg_servico_promove_cadastro só dispara para modalidade != 'autovistoria'

7. Monitoramento aprova (fila Aprovação de Associados)
   └── chama ativar-associado
   └── ativar-associado: lock + CAS + valida rastreador + grava
       associados.status='ativo', contratos.status='ativo', veiculos.status='ativo'
   └── enfileira em sga_sync_queue tipo='cadastro_associado'

8. SGA sync (não-bloqueante)
   └── sga-hinova-sync consome fila, força situação PENDENTE (3)
   └── operador promove a ATIVO no painel SGA manualmente
```

Cron de segurança: `reconciliar-contratos-pos-monitoramento` roda a cada 15 min e destrava contratos parados em `assinado` quando Monitoramento já aprovou mas o `ativar-associado` falhou (ex.: timeout). Cron `fn_reconciliar_status_pos_instalacao` (15 min) garante que veículo não fica preso em `instalacao_pendente` após instalação concluída.

## Variações por fluxo

### Fluxo Comum (Nova Adesão)

| Faixa FIPE | Autovistoria | Rastreador | Caminho |
|---|---|---|---|
| Acima do mínimo (Carro ≥30k, Moto ≥9k, Diesel sempre) | Opcional (enxuta) | Obrigatório | Etapas 1→8 completas. Se autovistoria opcional rodar, Cadastro libera R/F antes da instalação. Instalação obrigatória. |
| Abaixo do mínimo (sub-FIPE) | OBRIGATÓRIA (completa: 31/15 + vídeo) | Dispensado | `instalacoes` NÃO é criada (memória `sub-fipe-sem-instalacao`). Artefato canônico = `servico vistoria_entrada` da autovistoria. Cadastro aprova → cotação vai direto para Monitoramento. |

Regra dos 48h: se instalação acima-FIPE não acontecer em 48h após aprovação, cobertura é suspensa (contrato e mensalidade seguem). Religa via `fn_reativar_cobertura_pos_instalacao` quando instalação concluir.

### Fluxo Troca de Titularidade

Lê: `mem://logic/sales/troca-titularidade-fluxo-canonico-e2e` e `mem://logic/operations/troca-titularidade-etapas-obrigatorias`.

- Disparado quando associado antigo assina **termo de cancelamento**. Detecção: webhook `autentique-webhook` (preferido) + polling `autentique-sync-termo-cancelamento` (fallback obrigatório no front, webhook anda instável).
- **Cotação nasce on-demand** via botão "Realizar Cotação" no ModalDetalhesTroca → abre CotacaoFormDialog padrão com `origemTroca` → cotação criada e vinculada via edge `vincular-cotacao-troca`. Edge legacy `criar-cotacao-troca-titularidade` retorna 410.
- Marcas canônicas: `cotacoes.tipo_entrada='troca_titularidade'` E `cotacoes.origem_troca_titularidade=TRUE` (as duas — se só uma estiver, a cotação está malformada).
- Autovistoria **nunca é necessária** — veículo já é conhecido.
- Janela mesmo-dia: até 23:59:59 BRT do dia da assinatura do termo, vistoria inicial é DISPENSADA (proteção herdada). Passou: cron expira a solicitação.
- Promoção ao Cadastro: termo assinado → `cotacao_em_andamento`. Só vira `aguardando_cadastro` via `trg_troca_promove_cadastro_via_cotacao` quando cotação chega em `aguardando_aprovacao_cadastro`. Cadastro da troca SEMPRE manual.
- Efetivação (Monitoramento aprovou) NÃO chama `ativar-associado` — chama `efetivar-troca-titularidade`. 3 etapas BLOQUEANTES: (1) transferir veículo, (2) criar contrato novo com `cadastro_aprovado=true`, (3) cancelar contrato anterior. SGA (4) e ASAAS (5) são não-bloqueantes. Religa cobertura + reaponta rastreador (6.1/6.2) são não-bloqueantes mas obrigatórios.
- SGA Hinova: chama `POST /alterar/veiculo` (`alterarVeiculoHinova`), **NUNCA** inativa+cadastra (inativação não libera índice de placas).

### Fluxo Substituição de Placa

- Início: menu Substituição → informa placa atual → consulta SGA → mostra associado vinculado com situação financeira.
- **Trava de débito do MESMO veículo** bloqueia substituição. `tipo_entrada='substituicao_placa'` é canônico (alias `'substituicao'` é normalizado antes de gravar).
- Cotação criada no padrão normal, aproveitando nome/email/telefone do associado. Daí em diante segue exatamente Fluxo Comum, apenas marcada como substituição para relatórios.
- `efetivar-substituicao` chama `veiculo/alterar-situacao-para/2/:codigo` no SGA para inativar veículo substituído (não-bloqueante).

### Fluxo Sub-FIPE (especialização do Comum)

- Sem rastreador, sem `instalacoes`. Único artefato = `servico vistoria_entrada` modalidade=autovistoria.
- Cadastro aprova → libera R/F + promove serviço a `concluida` → Monitoramento decide se manda técnico só pra tirar fotos OU aprova direto.
- **Nunca dispara `cobertura_360_ativada_v3` antes do Monitoramento aprovar.** Três camadas de defesa: `trg_inclusao_isenta_auto_instalacao` ignora veículos sem rastreador obrigatório + `ativar-associado` coage cobertura flags a false quando `aguardar_instalacao=true` + `aprovar-proposta` relê `veiculos.status/cobertura_total` antes de notificar.

## Diagnóstico rápido (quando algo travou)

Ordem de inspeção. Pare na primeira anomalia.

1. **`cotacoes.status_contratacao`** — está onde deveria? Se `ativo`, todos os campos do invariante 7 batem?
2. **`contratos.cadastro_aprovado` + `aprovado_em` + `status`** — coerentes entre si?
3. **`veiculos.status`** — `instalacao_pendente` exige `servicos` ou `instalacoes` concluída para promover; `ativo` exige rastreador físico se obrigatório.
4. **`solicitacoes_troca_titularidade.cotacao_id`** (se troca) — aponta para a cotação CERTA? Caso real: vendedor cria cotação 2x, A fica com contrato e B "vence" a vinculação. Memória `mem://logic/sales/troca-titularidade-cotacao-on-demand`.
5. **`sga_sync_queue`** — tem item `falha_permanente`? Linkar para `/configuracoes/integracoes/sga-hinova?placa=XXX` (NUNCA criar visão paralela). Memória `mem://infrastructure/integrations/sga-sync-queue-canonical`.
6. **`logs_auditoria`** filtrado por `registro_id` da cotação/contrato — reconstrói cronologia quando edge logs já saíram da retenção.

## Antes de alterar, leia

A camada de memórias detalhadas que esta skill costura:

- `mem://logic/quotation/manual-fluxos-cotacao-auditado-v1` — guarda canônica E2E dos 4 fluxos + checklist obrigatório antes de alterar
- `mem://logic/quotation/fluxo-canonico-cotacao-8-etapas`
- `mem://logic/operations/cadastro-escopo-canonico` + `cadastro-rf-guards-db`
- `mem://logic/sales/troca-titularidade-fluxo-canonico-e2e` + `troca-titularidade-etapas-obrigatorias`
- `mem://logic/operations/recompute-cotacao-respeita-caminho-canonico-do-veiculo`
- `mem://logic/operations/sub-fipe-sem-instalacao` + `sub-fipe-nao-anuncia-protecao-ativada-pre-monitoramento`
- `mem://logic/operations/sincronizacao-status-pos-instalacao`
- `mem://architecture/activation/single-source-activation`

## Heurística final

Se você está prestes a escrever um `UPDATE` que muda `status`, `cadastro_aprovado`, `status_contratacao`, ou pular uma fila (Cadastro ou Monitoramento), **pare**. Existe quase certeza uma edge ou trigger canônico que faz isso. Procurar 2 minutos no codebase economiza um guard de DB rejeitando seu commit ou — pior — um veículo ativado sem rastreador.
