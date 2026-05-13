## Auditoria templates Meta — confirmações + correções pendentes

### Tabela de verificação (após últimas mudanças)

| Template | Disparo correto? | Destinatário | Onde dispara | Observação |
|---|---|---|---|---|
| `cobranca_inadimplencia_pratic` | ✅ | Associado inadimplente | `disparar-cobranca-csv-meta` | Disparado via Importar CSV (SGA), agrupando boletos |
| `suspensao_cobertura_nao_instalacao_v1` | ⚠️ Parcial | Associado | `cron-suspender-cobertura-inativacao` + `suspender-cobertura-instalacao-manual` | **Conta a partir de `contratos.data_assinatura`, não do agendamento da vistoria** — fora da regra que você definiu |
| `troca_titularidade_solicitada` | ✅ | Antigo titular | `criar-solicitacao-troca-titularidade` | OK |
| `troca_titularidade_termo_pendente` | ✅ | Antigo titular | `enviar-termo-cancelamento-troca` (preferencial; fallback `assinatura_documento_v2`) | Ainda em DRAFT na Meta — precisa enviar rascunho |
| `troca_titularidade_reprovada` | ✅ | Antigo titular | `reprovar-troca-titularidade` | DRAFT na Meta — enviar rascunho |
| `troca_titularidade_aprovada` | ✅ | Novo titular | `efetivar-troca-titularidade` | DRAFT na Meta — enviar rascunho |
| `autorizacao_fipe_diretoria_v4` | ✅ | Todos diretores (com telefone) | `notificar-diretoria-fipe` | OK |
| `termo_filiacao_assinatura_v2` | ✅ | Associado | `_shared/enviar-termo-filiacao-whatsapp.ts` (PRIMARY) | Fallback para `assinatura_documento_v2` se não APPROVED |
| `cobertura_360_ativada_v3` | ✅ | Associado | `notificar-cliente` (mapping `cobertura_total_ativada`) | Funcionando |
| `assinatura_instalacao_v1` | ⚠️ | Associado | `concluir-instalacao-prestador` | Wiring novo OK, mas **URL do botão no template aponta para `app.praticprotecao.com.br/acompanhar/{{1}}`**, contrariando a regra fixa do projeto (`https://app.praticcar.org`). Precisa atualizar URL do template na Meta (a substituição na URL é parte fixa, só `{{1}}` é o token dinâmico) |
| `confirmacao_manha_v1` | ✅ | Associado | `confirmar-vistorias-manha-cron` (turno manhã); webhook `whatsapp-meta-webhook` mantém contexto via `confirmacoes_agendamento.contexto_ia` (status `aguardando_confirmacao_manha`) → IA continua a conversa |
| `confirmacao_vespera_v1` | ✅ | Associado | `enviar-confirmacao-manual` (D-1, 18h) | Contexto da IA preservado via mesmo mecanismo |
| `boas_vindas_agencia_v1` | ✅ | Agência (vendedor recém-criado) | `create-user` quando `tipo='agencia'` | OK |
| `prestador_nova_instalacao_v2` | ✅ | Prestador externo | `gerar-link-prestador` | Link já vai como `{{6}}` no corpo (não há botão no template) |
| `emissao_boleto_gerado_v2` | ⚠️ | Associado | `disparar-boletos-lote` + UI `CobrancasList` | Wiring OK, **mas legado `cobranca_mensalidade` ainda é disparado em `gerar-faturas-mensais`, `gerar-cobrancas-mensais` e `enviar-lembretes-vencimento`** (precisa migrar) |
| `d_6_lembrete_desconto_v1`, `d0_boleto_vence_hoje_v1`, `d8_urgencia_revistoria_v1`, `d11_aviso_negativacao_v1`, `d14_d61_reativacao_protecao_v1` | ✅ | Associado | `executar-regua-cobranca` (régua de cobrança) | Mesma estrutura de envio padronizada |
| `confirmacao_agendamento_v1` | ⚠️ | Associado | `solicitar-encaixe` envia **imediatamente** (não 5 min após) | Sua regra: 5 min após criação do encaixe |
| `servico_atribuido_v1` | ✅ | Associado | `cron-atribuir-tarefas`, `notificar-inicio-rota`, `useAtribuicaoManual` | Estrutura padrão OK |
| `assinatura_documento_v2` | ✅ | Associado | `_shared/enviar-termo-filiacao-whatsapp.ts` (fallback), `enviar-termo-cancelamento-troca`, `enviar-termo-cancelamento-substituicao` | Botão `https://assina.ae/{{1}}` recebe `link.short_link` Autentique. Sem conflito quando o template específico (filiação/troca) está APPROVED |
| `reagendamento_servico` | ✅ | Associado que não compareceu | `enviar-link-reagendamento` (gatilho) + `cron-followup-reagendamento` (re-envios 1h/2h/3h) | Marcação de `nao_compareceu` ocorre quando a janela vence (`cron-reagendamento-automatico`) — precisa confirmar regra de “60 min após horário marcado” |
| `tecnico_a_caminho_1` | ✅ | Associado | `notificar-cliente` (tipo `tecnico_a_caminho`) | Padrão de referência |
| `tarefa_vistoriador_v2` | ✅ | Vistoriador externo | `gerar-link-vistoriador-prestador` | Link já enviado via `template_button_params` |
| `documentacao_pendente` | ⚠️ | Associado | `notificar-cliente` (tipos `documentos_solicitados`, `lembrete_documentos`, `documento_reprovado`) | **Template hoje tem só 2 vars (nome + lista). Link de upload é injetado como texto na lista — não vai como botão.** Acionado por: cadastro/monitoramento que registram pendências (via `notificar-cliente`) |
| `cobertura_total_ativada` | ✅ | — | Não disparado em produção (substituído por `cobertura_360_ativada_v3`) | Marcar como legado / esconder na UI |
| `cadastro_aprovado_botao` | ❌ | — | **Ainda usado em 6 mapeamentos do `notificar-cliente` + `efetivar-substituicao-titularidade` legacy** | Você pediu para descontinuar |

### Correções recomendadas (a executar quando aprovar este plano)

1. **48h da suspensão de cobertura** — alterar `cron-suspender-cobertura-inativacao` e `suspender-cobertura-instalacao-manual` para usar a data do agendamento da instalação/vistoria (`instalacoes.data_agendada` + horário, ou `servicos.data_agendada`) em vez de `contratos.data_assinatura`. Manter UF (RJ 48h, SP 72h, default 72h).
2. **`cadastro_aprovado_botao`** — substituir os 6 usos no `notificar-cliente` por templates aprovados:
   - `cadastro_aprovado`, `proposta_aprovada_roubo_furto`, `proposta_aprovada_cobertura_total`, `vistoria_aprovada`, `pagamento_confirmado` → mapear para `cobertura_360_ativada_v3` (com link via WhatsApp em mensagem auxiliar) OU criar/aprovar um template novo `cadastro_aprovado_v2`. Decidir comigo qual abordagem.
3. **`cobranca_mensalidade` legado** — substituir em `gerar-faturas-mensais`, `gerar-cobrancas-mensais`, `enviar-lembretes-vencimento` por `emissao_boleto_gerado_v2` (mesmas vars: nome, modelo, placa, vencimento, valor, linha digitável).
4. **`assinatura_instalacao_v1`** — corrigir URL do botão na Meta de `app.praticprotecao.com.br/acompanhar/{{1}}` para `app.praticcar.org/acompanhar/{{1}}` (alinhar com a regra de domínio de produção). Requer reenviar template para aprovação Meta.
5. **`confirmacao_agendamento_v1` (encaixe)** — adiar disparo em 5 minutos após criação do encaixe. Implementação: agendar `pg_cron`/`pg_net` one-shot ou enfileirar via tabela `confirmacoes_agendamento` com `enviar_apos`. Resposta SIM **não** deve atribuir; apenas marcar `confirmacao_whatsapp='confirmado_associado'` para o badge "CONFIRMADO PELO ASSOCIADO" no campo do técnico e tooltip do mapa.
6. **`documentacao_pendente`** — submeter à Meta uma nova versão com botão URL `https://app.praticcar.org/acompanhar/{{token}}` e ajustar `notificar-cliente` para enviar `template_button_params` com o `link_token` do contrato. Confirmar gatilhos: cadastro reprovando documento, monitoramento solicitando foto.
7. **UI WhatsApp Templates** — ocultar/badge "legado" para `cobertura_total_ativada`, `cadastro_aprovado_botao`, `cobranca_mensalidade`, `prestador_nova_tarefa_v1`, `confirmacao_agendamento_v1` versão antiga. Filtro padrão "ocultar legados" já existe; basta adicionar nomes ao set de legados.
8. **Reenvio de rascunhos Meta** — ainda pendente: `troca_titularidade_aprovada`, `troca_titularidade_reprovada`, `troca_titularidade_termo_pendente` em DRAFT/PENDING. Submeter pelo botão "Enviar rascunhos" (Configurações > Integrações > WhatsApp).

### Fora do escopo (apenas confirmação)

- IA continua a conversa em respostas de confirmação (`confirmacao_manha_v1`, `confirmacao_vespera_v1`, encaixe) via `whatsapp-meta-webhook` que checa `confirmacoes_agendamento.status='aguardando_confirmacao_*'` e `contexto_ia` para retomar.
- Destinatários: cada wiring usa `associados.whatsapp || telefone` (cliente), `profiles.telefone` (interno), `vistoriadores_prestadores.whatsapp`/`prestadores_assistencia.whatsapp` (parceiros). Nenhum cruzamento detectado.

### Detalhes técnicos

- Arquivos afetados pelas correções 1–7:
  - `supabase/functions/cron-suspender-cobertura-inativacao/index.ts`
  - `supabase/functions/suspender-cobertura-instalacao-manual/index.ts`
  - `supabase/functions/notificar-cliente/index.ts`
  - `supabase/functions/gerar-faturas-mensais/index.ts`
  - `supabase/functions/gerar-cobrancas-mensais/index.ts`
  - `supabase/functions/enviar-lembretes-vencimento/index.ts`
  - `supabase/functions/solicitar-encaixe/index.ts` (+ nova migração `pg_cron` ou tabela de fila)
  - `src/components/integracoes/WhatsAppMetaTemplates.tsx` (lista de legados)
  - `src/lib/whatsapp/template-catalog.ts` (atualizar metadados)
- Templates a re-submeter na Meta: `assinatura_instalacao_v1` (URL), `documentacao_pendente` (adicionar botão URL), `cadastro_aprovado_v2` (novo, opcional).