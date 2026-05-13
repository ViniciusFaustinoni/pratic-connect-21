## Diagnóstico (do que está hoje no banco/código)

### Status na Meta
- **47 APROVADOS**, **2 DRAFT** (`troca_titularidade_aprovada`, `troca_titularidade_reprovada`), **1 PENDING** (`troca_titularidade_termo_pendente`).
- DRAFT não envia. PENDING também não, até a Meta aprovar.

### Erros recentes (últimos 5 dias)
17 erros, **todos** com a mesma causa: `whatsapp-send-text` chamado **sem `template_name`** → bloqueado pela proteção (Meta API ativa exige template fora da janela 24h). Origem: chamadas internas/IA que não passam template (ex.: `notificar-cliente` cai num fallback hard-coded para `sinistro_atualizado`).

### Templates aprovados na Meta mas SEM nenhum disparador no código
- `suspensao_cobertura_nao_instalacao_v1` — aprovado, mas a função `cron-suspender-cobertura-inativacao` não envia WhatsApp.
- `troca_titularidade_solicitada` — aprovado, **nenhuma** edge function chama (`criar-solicitacao-troca-titularidade` não dispara WA).
- `assinatura_instalacao_v1` — aprovado, **nenhuma** edge function chama (`concluir-instalacao-prestador` não envia link p/ associado assinar).
- `emissao_boleto_gerado_v2` — aprovado, **nenhuma** edge function chama (`asaas-webhook` em `PAYMENT_CREATED` só envia `notificacao_geral_v1`).
- `prestador_nova_instalacao_v2` — aprovado, **nenhuma** edge function chama (link do prestador não dispara WA — só vistoriador via `tarefa_vistoriador_v2`). Além disso o template **não tem botão de link** — o link vem no corpo via `{{N}}`, então é OK, mas falta wiring.
- `confirmacao_manha_v1` — aprovado, **nenhuma** chamada (cron `confirmar-vistorias-manha-cron` usa `confirmacao_agendamento_v1`).
- `d14_d61_reativacao_protecao_v1`, `d_6_lembrete_desconto_v1`, `d0_boleto_vence_hoje_v1`, `d8…/d10…/d11…` — só são disparados se a régua de cobrança (`executar-regua-cobranca`) tiver etapas configuradas com esses `template`. Hoje as etapas do banco precisam ser conferidas.

### Templates funcionando corretamente (referência — não mexer)
`cobertura_360_ativada_v3`, `tecnico_a_caminho_1`, `confirmacao_agendamento_v1`, `confirmacao_vespera_v1`, `cobranca_inadimplencia_pratic`, `tarefa_vistoriador_v2`, `reagendamento_servico`, `documentacao_pendente`, `assinatura_documento_v2`, `termo_filiacao_assinatura_v2` (envia em `_shared/enviar-termo-filiacao-whatsapp.ts` com fallback).

### Templates legados / a ocultar
- `cobertura_360_ativada` (use `_v3`)
- `cobertura_total_ativada` (não usar)
- `cadastro_aprovado_botao` (não usar — porém ainda é referenciado em `notificar-cliente` e `efetivar-troca-titularidade`; precisa redirect)
- `autorizacao_fipe_diretoria` (use `_v4`)

---

## Plano de execução

### 1. Aprovar / reenviar templates pendentes
- Resetar `troca_titularidade_aprovada` e `troca_titularidade_reprovada` (já estão DRAFT) e reenviar via `whatsapp-submit-template`.
- `troca_titularidade_termo_pendente` está PENDING há tempo — reenviar para destravar.

### 2. Implementar disparos faltantes (edge functions)

| Template | Onde adicionar o envio | Gatilho |
|---|---|---|
| `troca_titularidade_solicitada` | `criar-solicitacao-troca-titularidade` | logo após criar a solicitação, p/ associado **antigo** |
| `troca_titularidade_termo_pendente` | `enviar-termo-cancelamento-troca` | substituir/adicionar disparo, p/ associado antigo |
| `troca_titularidade_aprovada` | `efetivar-troca-titularidade` (no momento da assinatura) | p/ vendedor + associado antigo (substituir `cadastro_aprovado_botao`) |
| `troca_titularidade_reprovada` | `reprovar-troca-titularidade` | p/ associado antigo + vendedor |
| `suspensao_cobertura_nao_instalacao_v1` | nova chamada dentro do trigger/cron de suspensão 48h pós-agendamento | enviar p/ associado |
| `assinatura_instalacao_v1` | `concluir-instalacao-prestador` (após aprovação técnica do veículo, mesmo c/ ressalvas) | enviar p/ associado com **link Autentique curto** (`assina.ae/{{1}}`) |
| `emissao_boleto_gerado_v2` | `asaas-webhook` em `PAYMENT_CREATED` (substituir o `notificacao_geral_v1` atual) | p/ associado |
| `prestador_nova_instalacao_v2` | `gerar-link-prestador` (equivalente ao de vistoriador) | p/ prestador, **incluindo link** no corpo via parâmetro |
| `confirmacao_manha_v1` | `confirmar-vistorias-manha-cron` (substituir `confirmacao_agendamento_v1` no cenário matinal) | p/ associado |

### 3. Corrigir o "fallback que vira sinistro_atualizado"
- `notificar-cliente/index.ts` linha 632: remover o `sendBody.template_name = 'sinistro_atualizado'` como fallback genérico — substituir por `notificacao_geral_v1` apenas em casos sem mapeamento, e logar o tipo desconhecido.
- `whatsapp-send-text/index.ts`: o auto-fallback para `sinistro_atualizado` é a causa de envios trocados quando outras funções esquecem `template_name`. Trocar para `notificacao_geral_v1` (genérico) e elevar log para `error`.

### 4. Verificar régua de cobrança (d0/d6/d8/d10/d11/d12/d13/d14)
- Consultar tabela `regua_cobranca`/`regua_cobranca_etapas` para confirmar que cada etapa tem `template` preenchido com o nome correto e `ativa=true`.
- Quaisquer etapas órfãs ou apontando para template legado serão corrigidas via insert tool.

### 5. Confirmar links nos templates com botão
- `assinatura_documento_v2`, `assinatura_instalacao_v1`, `termo_filiacao_assinatura_v2`, `cadastro_aprovado_botao`, `boas_vindas_agencia_v1`, `reagendamento_servico`, `autorizacao_fipe_diretoria*`, `troca_titularidade_termo_pendente`: validar que cada chamada está passando `template_button_params` (token curto Autentique 4–16 chars OU token público) — auditoria leitura, sem mexer onde já estiver OK.

### 6. UI — Página `/configuracoes/integracoes/whatsapp` (aba Templates Meta)
- **Ocultar** (filtro padrão) os templates marcados como **legado/não-usar**: `cobertura_360_ativada`, `cobertura_total_ativada`, `cadastro_aprovado_botao`, `autorizacao_fipe_diretoria`. Adicionar toggle "Mostrar legados".
- O catálogo `src/lib/whatsapp/template-catalog.ts` (já criado em sessão anterior) será atualizado para refletir todos os disparadores reais e os marcadores `deprecated: true` correspondentes.
- Tooltip `?` por linha já existe; revisar textos para os templates novos/corrigidos.

### 7. Confirmar continuidade IA em respostas a confirmações
- `whatsapp-meta-webhook` + `whatsapp-webhook`: confirmar que respostas a `confirmacao_manha_v1` / `confirmacao_vespera_v1` / `confirmacao_agendamento_v1` entram no fluxo da IA com contexto (procurar `referencia_tipo='confirmacao_*'` na busca de histórico). Se não estiver mapeado, adicionar.

### Confirmações de saída
1. Templates com link enviam o link correto (assinatura_*, prestador_nova_instalacao_v2, tarefa_vistoriador_v2, documentacao_pendente).
2. Destinatários corretos (associado vs vendedor vs diretor vs prestador) — checagem manual por função.
3. Legados/ocultos saem da listagem padrão.
4. Cada disparo acontece no momento descrito (gatilhos da tabela acima).
5. Causa raiz dos erros recentes (`Bloqueado: Meta API ativa requer template_name`) eliminada — fallback do `whatsapp-send-text` migrado para `notificacao_geral_v1` e chamadas internas explícitas.

### Fora de escopo
- Criar templates novos.
- Mudar copy aprovada na Meta.
- Mexer em `cobertura_360_ativada_v3`, `tecnico_a_caminho_1`, `confirmacao_vespera_v1`, `cobranca_inadimplencia_pratic` (já funcionam).
