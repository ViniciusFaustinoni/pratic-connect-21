# Alinhamento Completo do Fluxo de Eventos

Sete frentes de ajuste, em ordem de prioridade. Cada item já foi validado contra o que existe hoje no projeto.

---

## 1. Validação de carência por cobertura na abertura

**Hoje:** o modal de abertura só bloqueia carência de **vidros**. Demais coberturas (colisão, roubo, furto, fenômeno natural, vandalismo, terceiros) e benefícios de assistência não são validados.

**O que fazer:**
- Estender `NovoSinistroModal` e `criar-sinistro` para, ao escolher o tipo, consultar a carência da cobertura correspondente do plano do associado (lendo de `coberturas` + `planos_coberturas` + dados do contrato).
- Bloquear abertura quando a data atual estiver dentro da carência, mostrando data de liberação. Permitir override apenas com `carencia_X_isenta = true` no contrato (mesmo padrão do vidros).
- Mesma checagem para benefícios de assistência (reboque, chaveiro, etc.) ao abrir chamado de assistência.
- A IA do WhatsApp (Maya) deve consultar a mesma função antes de criar o sinistro e responder ao associado se estiver em carência.

---

## 2. Unificar atribuição Regulador OU Técnico no Monitoramento

**Hoje:** Regulador existe como perfil, mas opera por fila própria. O Monitoramento atribui apenas técnicos via `agendamentos_base` / `servicos`.

**O que fazer:**
- No agendamento da vistoria de evento gerada pelo link público, exibir no Monitoramento um seletor "Tipo de executor: Técnico interno / Regulador / Prestador externo".
- Criar registro em `servicos` com `executor_tipo` (novo campo) e `executor_id` apontando para o user do regulador quando aplicável.
- A tela `ExecutarVistoriaEvento` (regulador) e a tela do técnico devem compartilhar o mesmo componente de execução, garantindo paridade — incluindo o upload do PDF de orçamento (item 3).
- Ao concluir, fechar em cascata o serviço e o agendamento_base (já existe o trigger `trg_sync_agendamento_base_on_servico_terminal`).

---

## 3. Vistoria sem materiais manuais — PDF + IA para todos os executores

**Hoje:** `extract-orcamento-pdf` + `OrcamentoPDFImport` existe **só na UI do Regulador**.

**O que fazer:**
- Mover `OrcamentoPDFImport` + `VistoriaEventoOrcamento` para um componente compartilhado usado por Regulador, Técnico e Prestador.
- Bloquear input manual de itens — só aceita peças/valores vindos do PDF interpretado (com possibilidade de editar quantidades, mas não criar item do zero).
- Garantir que o PDF original fica anexado à `vistorias_evento` para auditoria do analista.

---

## 4. Cron de lembretes de coparticipação (3/3 dias, expira em 60 dias)

**Hoje:** não existe. Há `enviar-lembretes-vencimento` genérico de cobrança, não de coparticipação de evento.

**O que fazer:**
- Nova edge function `cron-lembrete-coparticipacao` agendada via pg_cron diário.
- Lê coparticipações pendentes (status, `data_geracao`), envia template Meta a cada 3 dias contados da geração.
- Aos 60 dias sem pagamento: marca `expirada`, notifica analista de eventos, bloqueia geração de OS.
- Quando a taxa é gerada, disparar `enviar-mensagem-sinistro` com o link público atualizado e template específico "Sua taxa de coparticipação foi gerada" (a IA reenvia o link no WhatsApp).
- Templates Meta a criar: `coparticipacao_gerada`, `coparticipacao_lembrete`, `coparticipacao_expirando_72h`, `coparticipacao_expirada`.

---

## 5. OS só após confirmação do pagamento

**Hoje:** `gerar-os-cotacao-aprovada` é disparada na aprovação da cotação pelo analista.

**O que fazer:**
- Mover o gatilho de criação da OS para o webhook do Asaas (`asaas-verificar-cota-sinistro`) — quando o pagamento é confirmado, então cria a OS automaticamente.
- Na aprovação da cotação, apenas marcar `aguardando_pagamento_coparticipacao` e gerar a cobrança.
- Caso o associado seja isento de coparticipação no plano, OS é gerada na hora da aprovação (mantém comportamento atual condicionalmente).

---

## 6. Aprovação complementar de itens descobertos no reparo

**Hoje:** `AdicionarItemOSModal` adiciona item direto na OS, sem aprovação formal.

**O que fazer:**
- Novo status em `ordens_servico_itens`: `aguardando_aprovacao_complementar`.
- Itens adicionados pela oficina entram nesse status; OS pausa execução do item.
- Notificar analista de eventos via app + WhatsApp template.
- Tela do analista: aprovar/recusar com justificativa. Aprovado vira `aprovado` e gera lançamento adicional em `contas_pagar`. Recusado é descartado.
- Eventual coparticipação adicional segue o mesmo fluxo do item 4/5.

---

## 7. Custo total por cobertura

**Hoje:** lançamentos em `contas_pagar` referenciam o sinistro mas não a cobertura específica.

**O que fazer:**
- Adicionar `cobertura_id` (FK para `coberturas`) em: `contas_pagar`, `evento_cotacoes_pecas`, `ordens_servico_itens`, lançamentos de reboque vinculados ao evento.
- Backfill: preencher `cobertura_id` dos eventos existentes a partir de `sinistros.tipo` mapeado por `TIPO_SINISTRO_TO_COBERTURA`.
- Nova view `vw_custo_evento_por_cobertura` agregando todos os lançamentos do evento por `cobertura_id`.
- Tela do analista: nova aba "Custo por cobertura" no detalhe do evento mostrando peças, mão-de-obra, reboque, depreciação, total por cobertura.
- Relatório agregado em `eventos/SinistrosDashboard` com filtro por período: custo por cobertura por plano (insumo de pricing).

---

## Ordem de execução sugerida

```text
Fase 1 (curto prazo, alto impacto)
  1. Validação de carência por cobertura
  4. Cron de lembretes de coparticipação + templates Meta
  5. OS pós-pagamento

Fase 2 (estrutural)
  2. Unificação Regulador/Técnico no monitoramento
  3. PDF+IA compartilhado entre executores

Fase 3 (analytics e governança)
  6. Aprovação complementar de itens
  7. Custo por cobertura (schema + view + UI + relatório)
```

---

## Detalhes técnicos

- **Migrações novas:** colunas `cobertura_id` em 4 tabelas; coluna `executor_tipo` em `servicos`; novo enum status `aguardando_aprovacao_complementar`; view `vw_custo_evento_por_cobertura`.
- **Edge functions novas:** `cron-lembrete-coparticipacao`, `validar-carencia-cobertura` (compartilhada UI + Maya).
- **Edge functions alteradas:** `criar-sinistro` (carência), `gerar-os-cotacao-aprovada` (mover gatilho), `asaas-verificar-cota-sinistro` (criar OS no pagamento confirmado), `extract-orcamento-pdf` (unificar consumidores).
- **Componentes novos/alterados:** componente compartilhado `ExecutarVistoriaUnificada`, aba "Custo por cobertura" no `SinistroAnalise`, modal de aprovação complementar.
- **Templates Meta a aprovar (4):** geração, lembrete, expirando, expirada da coparticipação.
- **pg_cron:** novo job diário para lembretes; revisão dos demais já existentes.

Aprove para eu começar pela Fase 1 (itens 1, 4 e 5).
