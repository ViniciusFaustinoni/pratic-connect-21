
## Fluxo correto da Troca de Titularidade (referência para validar)

```text
Operador interno
   └─ cria solicitação + envia Termo de Cancelamento (Autentique, biometria) ao TITULAR ANTIGO
        └─ titular antigo assina
              └─ webhook autentique:
                   • marca termo_cancelamento_assinado_em
                   • veiculos.em_troca_titularidade = true + cobertura suspensa
                   • libera link público do NOVO titular
                        └─ NOVO titular percorre o MESMO stepper de nova adesão:
                             1. Plano
                             2. Documentos (CNH, comp. residência)
                             3. ►► ASSINATURA DO TERMO DE FILIAÇÃO ◄◄   (Autentique, novo contrato)
                             4. Vistoria — DISPENSADA na janela mesmo-dia
                             5. Pagamento (se houver)
                                  └─ cotacoes.status_contratacao = aguardando_aprovacao_cadastro
                                       └─ trigger trg_troca_promove_cadastro_via_cotacao
                                            → solicitacoes_troca_titularidade.status = aguardando_cadastro
                                                 └─ Cadastro aprova (aprovar-troca-cadastro)
                                                      → aguardando_monitoramento
                                                           └─ Monitoramento aprova / pede vistoria / pede manutenção rastreador
                                                                └─ efetivar-troca-titularidade
                                                                     • transfere veículo
                                                                     • novo contrato nasce cadastro_aprovado=true
                                                                     • limpa cobertura_suspensa
                                                                     • SGA sync
```

A etapa 3 (assinatura do novo Termo de Filiação pelo novo titular) **existe** no código (`EtapaAssinaturaContrato`), mas o link público de `COT-20260519-181838041-120` está pulando direto para "Em análise pelo Cadastro" por causa do estado inconsistente da base (solicitações duplicadas no mesmo `cotacao_id` + fallback errado em `CotacaoContratacao.tsx`).

## Plano

### Etapa 1 — Reset dos dados de teste (migração)

Vou rodar uma migração que **só toca em dados de troca** (NÃO altera schema, NÃO mexe em código). Em uma transação:

1. Identificar todos os `cotacao_id`/`contrato_id`/`veiculo_id`/`associado_id` envolvidos em qualquer linha de `solicitacoes_troca_titularidade`.
2. **Cancelar termos pendentes no Autentique**: marcar `solicitacoes_troca_titularidade.termo_cancelamento_status = 'cancelado_reset'` e logar `autentique_documento_id` em uma tabela de auditoria (`troca_titularidade_reset_log`) para o operador cancelar manualmente no painel Autentique se quiser. (Não dá pra deletar remoto via SQL.)
3. **Restaurar veículos afetados** (todos os `veiculos.em_troca_titularidade = true` ou referenciados em `solicitacoes_troca_titularidade.veiculo_id`):
   - `em_troca_titularidade = false`
   - `cobertura_suspensa = false`, `cobertura_suspensa_motivo = NULL`, `cobertura_suspensa_em = NULL`
   - `status` volta para `'ativo'` se havia contrato ativo (preserva contrato do titular ANTIGO intacto)
   - Mantém `associado_id` do titular ANTIGO (não toca em transferências já efetivadas)
4. **Apagar cotações de teste** (`cotacoes` onde `tipo_entrada = 'troca_titularidade'` OU id referenciado em solicitações):
   - Cascata: `cotacoes_vistoria_fotos`, `cotacoes_documentos`, `contratos_documentos` e `contratos` ainda em `status IN ('rascunho','aguardando_assinatura','assinado')` vinculados a essas cotações.
   - **NÃO toca** em contratos `ativo` (são do titular antigo, intactos).
5. **Apagar `solicitacoes_troca_titularidade`** (todas as linhas) + tabelas filhas (`solicitacoes_troca_titularidade_eventos`, `solicitacoes_troca_titularidade_documentos`, vínculos em `dados_extras`).
6. **Limpar agendamentos órfãos**: `agendamentos_base`/`instalacoes`/`servicos` criados para essas cotações apagadas.
7. **Limpar `associados`** que foram criados como "novo titular" e nunca chegaram a ter contrato ativo (anti-órfão).

Resultado: base zerada para troca, veículo do Ford Fiesta (e qualquer outro) volta 100% ao titular antigo ativo, contratos históricos preservados.

### Etapa 2 — Correção do link público (código)

Aplicar as duas correções que ficaram pendentes da rodada anterior, agora que a base está limpa:

1. **`src/hooks/useSolicitacaoTrocaPublica.ts`** — `useSolicitacaoTrocaPublicaPorCotacao`:
   - Buscar por `solicitacao_troca_id` em `cotacoes.dados_extras` quando disponível (chave determinística).
   - Fallback: `cotacao_id` com `.neq('status','cancelada')` + `.order('created_at',{ascending:false}).limit(1).maybeSingle()`.

2. **`src/pages/cotacao/CotacaoContratacao.tsx`** — remover o fallback que mostra "Em análise pelo Cadastro" quando `solicitacaoTroca` é null/array. Comportamento correto:
   - Se `cotacao.tipo_entrada === 'troca_titularidade'` e termo de cancelamento assinado → renderizar o stepper normal (Plano → Documentos → **EtapaAssinaturaContrato** → Pagamento), exatamente como nova adesão.
   - Só renderizar `TelaAnaliseTrocaTitularidade` quando `cotacao.status_contratacao === 'aguardando_aprovacao_cadastro'` em diante.

3. **`TelaAnaliseTrocaTitularidade.tsx`** — garantir que essa tela só aparece pós-cadastro, nunca durante a contratação do novo titular.

### Etapa 3 — Validação manual após implementação

1. Criar nova solicitação de troca via tela interna.
2. Assinar termo de cancelamento (mock ou Autentique real).
3. Abrir link público → confirmar que o stepper mostra Plano → Documentos → **Assinatura do Contrato** → (Vistoria dispensada) → Pagamento.
4. Após pagar, conferir `cotacao.status_contratacao = aguardando_aprovacao_cadastro` e `solicitacao.status = aguardando_cadastro` na fila.
5. Aprovar no Cadastro → Monitoramento → efetivar.

## Detalhes técnicos (resumo de arquivos)

- **Migração** (Etapa 1) — única, idempotente, com `BEGIN`/`COMMIT`, sem `DROP` de tabela.
- **Frontend** (Etapa 2):
  - `src/hooks/useSolicitacaoTrocaPublica.ts` (query)
  - `src/pages/cotacao/CotacaoContratacao.tsx` (condicional de render)
  - `src/components/troca-titularidade/TelaAnaliseTrocaTitularidade.tsx` (guard)
- **Memória** — atualizar `mem://logic/operations/troca-titularidade-promocao-cadastro-canonica` reforçando que o link público do novo titular usa o stepper de nova adesão e NUNCA pula a assinatura do Termo de Filiação.

## Fora de escopo

- Edge functions `autentique-webhook`, `aprovar-troca-cadastro`, `efetivar-troca-titularidade` — já estão corretas.
- Triggers `trg_troca_promove_cadastro_via_cotacao` — já corretos.
- Cancelar documentos remotos no Autentique — operador faz manual via log de auditoria (limitação de API).
