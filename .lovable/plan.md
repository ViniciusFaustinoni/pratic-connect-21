
# Suspensão por Auto-Vistoria Não Instalada

## Diagnóstico do que já existe (e do que falha)

| Item | Status atual |
|---|---|
| Edge function `cron-suspender-cobertura-inativacao` que marca `veiculos.cobertura_suspensa=true` após 48h sem instalação | Existe, mas **prazo hardcoded em 48h**, **não filtra por `tipo_vistoria='autovistoria'`**, **não está agendada no `cron.job`** (nunca roda) e **não notifica o associado** |
| Configuração diretoria do prazo | Existem `sla_horas_instalacao` e `operacional_prazo_instalacao` mas **não são usados pela função** |
| Cobertura roubo/furto cair quando suspenso | `useMinhasCoberturasApp` só olha inadimplência — **ignora `cobertura_suspensa`** |
| Tela do Coordenador para liberar | **Não existe** |
| Tela pública voltar para etapa de agendamento após liberação | **Não existe** — fluxo público não conhece esse estado |
| Veículos hoje nessa condição | 0 (cron nunca rodou) |

Conclusão: a regra **não está funcional**. Vou implementar do zero usando a função existente como base.

## O que será feito

### 1. Configuração na Diretoria
- Nova chave em `configuracoes`: `prazo_instalacao_autovistoria_horas` (default `72`).
- Adicionar input no painel de configurações da Diretoria (seção "Operacional / Prazos") para o coordenador/diretoria editar.

### 2. Suspensão automática (corrigir e agendar)
Reescrever `cron-suspender-cobertura-inativacao` para:
- Ler o prazo da configuração `prazo_instalacao_autovistoria_horas`.
- Filtrar **apenas** contratos `tipo_vistoria='autovistoria'`, `status='ativo'`, com `data_assinatura` ultrapassada.
- Verificar instalação concluída em `servicos` (já existe).
- Ao suspender:
  - `veiculos.cobertura_suspensa=true`, `cobertura_suspensa_motivo='Auto-vistoria sem instalação no prazo'`, `cobertura_suspensa_em=now()`.
  - Disparar WhatsApp + push + e-mail para o associado avisando que perdeu **roubo/furto** até instalar (mensagem clara + link).
  - Registrar em `logs_auditoria`.
- **Não reverter automaticamente** suspensões "auto_vistoria_prazo" — só o Coordenador libera (ver passo 4). Suspensões antigas (motivo "Rastreador não ativado em 48h") mantêm reversão automática.
- Agendar via `pg_cron` para rodar de hora em hora.

### 3. Cobertura visível ao associado
Atualizar `useMinhasCoberturasApp` para tratar `cobertura_suspensa=true` como **bloqueio de roubo/furto e total**, com mensagem específica:
> "Sua cobertura está suspensa porque a instalação do rastreador não foi realizada no prazo da auto-vistoria. Aguarde liberação do nosso time de monitoramento."

Banner persistente no `AppHome` enquanto suspenso por esse motivo.

### 4. Tela de liberação (Monitoramento)
Nova página `src/pages/monitoramento/LiberacoesAutoVistoria.tsx`, acessível só ao **Coordenador de Monitoramento** e Diretoria (já há `monitoring-coordinator-permissions`).
- Lista veículos com `cobertura_suspensa=true` e motivo "Auto-vistoria sem instalação no prazo".
- Mostra: associado, placa/modelo, data assinatura, dias suspenso, contato.
- Ações: **Liberar para reagendar vistoria** (com campo motivo opcional).
- Adicionar item no menu lateral de Monitoramento e como card/aba dentro de `VistoriasInstalacoesMon` (aba "Liberações").

### 5. Efeito da liberação
Ao clicar "Liberar":
- Marca `veiculos.cobertura_suspensa=false`, limpa motivo/em.
- Novos campos em `contratos`: `liberado_reagendamento_em timestamptz`, `liberado_reagendamento_por uuid`, `liberado_reagendamento_motivo text`.
- Limpa `vistoria_completa_data_agendada` para reabrir agendamento.
- Dispara WhatsApp ao associado com o link público (`/cotacao/:token` → continua para etapa de agendamento).
- Log de auditoria.

### 6. Reabertura na tela pública
No fluxo público de cotação/contratação, detectar `contrato.liberado_reagendamento_em IS NOT NULL` **e** `vistoria_completa_data_agendada IS NULL` → renderizar novamente a etapa "Agendar vistoria/instalação" (componente já existe), continuando o fluxo normal até a conclusão da instalação. Após nova instalação concluída, a flag de suspensão não retorna automaticamente.

### 7. Reativação automática pós-instalação
Trigger ao concluir serviço de instalação (`servicos.status='concluida'`, `tipo='instalacao'`):
- Garantir que `veiculo.cobertura_suspensa=false` e `cobertura_total=true` / `cobertura_roubo_furto=true` conforme plano.
- Notificar associado: "Sua proteção completa está ativa".

## Arquivos afetados (resumo)

**Banco (migrations):**
- Insert da chave `prazo_instalacao_autovistoria_horas` em `configuracoes`.
- Colunas em `contratos`: `liberado_reagendamento_em`, `liberado_reagendamento_por`, `liberado_reagendamento_motivo`.
- `pg_cron.schedule` para a edge function (hourly).
- Trigger de reativação pós-instalação.

**Edge functions:**
- `supabase/functions/cron-suspender-cobertura-inativacao/index.ts` — reescrita.
- `supabase/functions/liberar-reagendamento-autovistoria/index.ts` — nova (chamada pela UI do Coordenador).

**Frontend:**
- `src/pages/diretoria/...` (form de configurações) — adicionar campo do prazo.
- `src/hooks/useMinhasCoberturasApp.ts` — considerar `cobertura_suspensa`.
- `src/pages/monitoramento/LiberacoesAutoVistoria.tsx` — nova.
- `src/pages/monitoramento/VistoriasInstalacoesMon.tsx` — nova aba "Liberações".
- Menu lateral monitoramento — novo item.
- Fluxo público de cotação — branch para reabrir etapa de agendamento.
- Banner em `AppHome` quando suspenso por esse motivo.

## Pontos a confirmar antes de codar

1. **Default do prazo**: 72h (igual a `operacional_prazo_instalacao`) ou outro valor?
2. **Notificação ao suspender**: WhatsApp + push + e-mail, ou só WhatsApp?
3. **Liberação**: o Coordenador libera manualmente caso a caso (proposto), ou também queremos um botão de "liberar em massa"?
