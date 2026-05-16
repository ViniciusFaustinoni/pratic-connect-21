## Reanálise — `COT-20260516-101252395-551` (Fiat Palio, FIPE R$ 36.472, carro → rastreador OBRIGATÓRIO)

Corrigindo o entendimento: **autovistoria não é exclusiva de sub-FIPE**. Aqui ela foi usada no modo "antecipação de R/F" — o que é legítimo. O problema NÃO é o cliente ter feito autovistoria; é a **instalação do rastreador não ter sido encaminhada** depois.

### Linha do tempo (cruzada com o fluxo canônico)

| # | Etapa canônica | O que aconteceu | OK? |
|---|----------------|-----------------|-----|
| 1 | Link público respeita FIPE | Cliente fez autovistoria antecipada (válido, libera R/F mais cedo) | ✅ |
| 2 | Cadastro vê com situação SGA | Caso chegou na fila | ✅ |
| 3 | Cadastro aprova → gera serviço de campo (instalação) + atualiza link público | Cadastro aprovou às 15:23: vistoria→`aprovada`, R/F liberado, `cadastro_aprovado=true`, veículo→`instalacao_pendente`. **Não foi criada `instalações` nem `agendamentos_base`** porque o cliente nunca passou pela etapa "Instalação" do link público (vistoria_completa_data_agendada NULL). O fluxo correto exigiria forçar a etapa Instalação a aparecer no link após autovistoria aprovada. | ❌ |
| 4 | Monitoramento vê serviço de campo | Sem fila — não tem `instalações` nem serviço de instalação | ❌ |
| 5-7 | Monitoramento atribui/aprova vistoria do técnico | Inacessível | ❌ |
| 8 | Ativa + envia SGA | Não chega | ❌ |

### Por que o link público não atualiza

`useCotacaoContratacao.determinarEtapa` mapeia `status_contratacao → etapa`. **Não conhece** `aguardando_aprovacao_cadastro`, `aguardando_aprovacao_monitoramento` nem `vistoria_concluida` (todos caem em `default → 0`). Soma-se ao recompute antigo que rebobinou para `contrato_assinado` → `pagamento_ok` antes do patch de 15:45. Hoje o link mostra etapa 5 (Conclusão/Instalação) mas como o cliente nunca preencheu a etapa Instalação, a tela aparece "vazia".

### Causa-raiz (corrigida)

**A. Após autovistoria aprovada com rastreador obrigatório, o link público não força/abre a etapa "Instalação" para o cliente agendar.** O cliente fez autovistoria, viu como concluída, e o link "ficou" — não pediu agendamento de instalação.

**B. `aprovar-proposta` aprova o Cadastro sem garantia de que a instalação está agendada.** Quando autovistoria libera R/F mas o veículo exige rastreador, o Cadastro só consegue aprovar se houver `vistoria_completa_data_agendada`. Hoje o ramo "autovistoria antecipada" libera R/F mesmo sem agendamento → veículo fica em `instalacao_pendente` sem caminho de saída.

**C. `determinarEtapa` (hook público) não cobre estados pós-cadastro.**

**D. Recompute (já corrigido às 15:45).**

## Plano de correção

### 1. Hook do link público — mapear estados pós-cadastro
`src/hooks/useCotacaoContratacao.ts → determinarEtapa`
- `aguardando_aprovacao_cadastro` → etapa 3 (Vistoria) read-only com badge "Aguardando análise do Cadastro" se autovistoria já enviada; ou etapa 5 com card "Em análise" se já estava em pagamento.
- `aguardando_aprovacao_monitoramento` → etapa 5 (Instalação se `tipo_vistoria='autovistoria'` + rastreador obrigatório), com card "Aguardando Monitoramento".
- `vistoria_concluida` → etapa 5 (Conclusão).

### 2. Link público — após autovistoria aprovada + rastreador obrigatório, abrir etapa Instalação
`src/pages/public/CotacaoContratacao.tsx` + `STEPS` já incluem `STEP_INSTALACAO` quando `tipo_vistoria='autovistoria'`. Adicionar:
- Quando `exigeRastreador().exige === true` E `cotacao.tipo_vistoria === 'autovistoria'` E (vistoria já existe aprovada OU `cadastro_aprovado=true`) → forçar `etapaAtual = índice da etapa Instalação` e renderizar form de agendamento (`AgendamentoBase` / `AgendamentoVistoriaCompleta`) — não o card "Conclusão".
- Confirmar `EtapaInstalacao` chama `criar-instalacao-pos-pagamento` (já existe), que materializa `instalações` + `agendamentos_base` quando o cliente confirma data/endereço.

### 3. `aprovar-proposta` — guard "autovistoria antecipada + rastreador obrigatório"
`supabase/functions/aprovar-proposta/index.ts`
- Já bloqueia 409 `sem_agendamento` quando não há vistoria/instalação/agendamento (`mem://logic/operations/aprovar-proposta-guard-sem-agendamento`). Validar que esse guard cobre o caso atual:
  - Há `vistoria_entrada` autovistoria, mas **sem `instalações` nem `agendamentos_base`** e **rastreador obrigatório**.
  - Se hoje o guard libera (porque há `vistoria_entrada`), refinar: se `precisaRastreador=true` E não existe `instalações` ativa para o veículo → retornar 409 `instalacao_nao_agendada` e reverter `cadastro_aprovado`.
- Mensagem orientadora: "Autovistoria liberou Roubo/Furto, mas a instalação do rastreador precisa ser agendada pelo link público antes da aprovação."

### 4. Backfill controlado — destravar `COT-20260516-101252395-551`
Migration única (mantém R/F liberado, só reabre etapa Instalação):
- Reverter `contratos.cadastro_aprovado = false` para esta cotação (motivo: faltou agendamento de instalação).
- `cotacoes.status_contratacao = 'aguardando_aprovacao_cadastro'` (mantém autovistoria já aprovada).
- Manter `veiculos.cobertura_roubo_furto = true` (R/F já liberado, não regredir).
- `veiculos.status = 'instalacao_pendente'` (já está).
- Log em `logs_auditoria` (`acao='editar'`, descrição: "Backfill: caso travado por falta de agendamento de instalação após autovistoria antecipada; reaberto para cliente agendar via link público").
- Resultado: a cotação volta para a fila do Cadastro com badge "Aguardando agendamento de instalação"; o cliente Leonardo pelo link público é redirecionado para a etapa Instalação e agenda; ao confirmar, `criar-instalacao-pos-pagamento` cria `instalações`+`agendamentos_base`+serviço; Cadastro aprova de novo, agora com instalação agendada; Monitoramento atribui técnico; vistoria/instalação real é feita; ativação via `ativar-associado`.

### 5. Memória
- ✅ Já criado `mem://logic/operations/autovistoria-dois-usos.md` (corrige o entendimento).
- Atualizar entrada no índice depois de mergeada a correção UI.

## Não-escopo
- Não tocar em `finalizar-autovistoria-cotacao` (autovistoria em si funciona).
- Não tocar em `recompute_cotacao_status_contratacao` (já patcheado às 15:45).
- Não alterar fluxo sub-FIPE.
- Não bloquear autovistoria para veículos acima do limite — ela é OPCIONAL e válida (antecipa R/F).

## Arquivos
- `src/hooks/useCotacaoContratacao.ts` (`determinarEtapa`)
- `src/pages/public/CotacaoContratacao.tsx` (forçar etapa Instalação após autovistoria aprovada + rastreador obrigatório; renderizar agendamento e não card de conclusão)
- `supabase/functions/aprovar-proposta/index.ts` (refinar guard `sem_agendamento` para incluir caso "autovistoria sem instalação")
- `supabase/migrations/<novo>_backfill_cot_101252395_551.sql`
- `mem://logic/operations/autovistoria-dois-usos.md` (já criado)
- `mem://index.md` (já atualizado)
