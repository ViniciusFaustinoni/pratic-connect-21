## Objetivo

Forçar o sistema (UI + backend) a respeitar de ponta a ponta o fluxo canônico de 8 etapas, eliminando o sintoma reportado: **proposta já aprovada pelo Cadastro reaparece na fila do Cadastro após a conclusão (instalação/vistoria/monitoramento/SGA)**.

## Diagnóstico do sintoma reportado

1. `usePropostasPendentes` consulta `contratos` filtrando apenas `status='assinado'` — **não exclui** `cadastro_aprovado=true`. Resultado: enquanto o contrato não vira `'ativo'` (só ocorre em `ativar-associado` após aprovação do Monitoramento), a proposta continua na fila do Cadastro mesmo já aprovada.
2. Se `ativar-associado` falhar / ficar pendente no `enqueue_integration` (SGA/Softruck/Rede), o contrato permanece `'assinado'` indefinidamente e a proposta "volta" visualmente para o Cadastro.
3. Não há badge claro de "fora da minha fila" — o Cadastro acha que precisa reanalisar.
4. A regra de fluxo canônico ainda não está formalizada como memória, então nada impede que outra implementação volte a tratar `cadastro_aprovado=true` como "ainda do cadastro".

## Mudanças propostas

### 1. Frontend — Tirar do Cadastro o que já foi aprovado

**`src/hooks/usePropostasPendentes.ts`**
- Adicionar filtro padrão `cadastro_aprovado.is.null,cadastro_aprovado.eq.false` na query principal (`.or(...)`), mantendo o `status='assinado'`.
- Manter a flag `cadastro_aprovado` no retorno apenas para casos do Monitoramento que precisem consultar (mas a fila do Cadastro nunca recebe `true`).

**`src/pages/cadastro/PropostasPendentes.tsx`**
- Remover/ajustar contadores que somavam aprovadas (`aguardando` deixa de incluir `cadastro_aprovado=true`).
- O card "Aprovados Hoje" passa a vir do `associados_historico` (tipo `cadastro_aprovado`), igual ao Monitoramento — não da lista local.
- Banner pequeno: "X proposta(s) aprovada(s) aguardando Monitoramento" com link para a tela do Monitoramento (somente leitura, não reabre na fila).

### 2. Backend — Não permitir "voltar para o Cadastro"

**Trigger Postgres `trg_protege_cadastro_aprovado` em `contratos`:**
- BEFORE UPDATE: se `OLD.cadastro_aprovado=true` e `NEW.cadastro_aprovado=false`, exigir que `NEW.aprovado_por IS NULL` venha acompanhado de coluna `motivo_devolucao_cadastro` preenchida (devolução explícita por Diretor). Caso contrário, RAISE EXCEPTION.
- Garantia de idempotência: `aprovar-proposta` continua o único caminho de marcar `cadastro_aprovado=true` (já é).

**Edge function `aprovar-proposta` (já existente):**
- Já reverte `cadastro_aprovado=false` em caso de LIMBO (sem instalação/vistoria/agendamento). Adicionar log estruturado em `sga_sync_logs` com `action='reverter_cadastro_aprovado_limbo'` para auditoria.

### 3. Reconciliação automática para contratos travados em `'assinado'` pós-monitoramento

**Cron job `fn_reconciliar_contratos_pos_monitoramento` (a cada 15 min):**
- Buscar contratos `status='assinado'` + `cadastro_aprovado=true` cujo `servicos` (instalação ou vistoria_entrada) esteja em `aprovada` há mais de 10 min.
- Para cada caso: tentar reinvocar `ativar-associado` (idempotente, lock + CAS).
- Em caso de falha persistente, gravar alerta em `sga_sync_logs` com `severity='warning'` para o time ver no dashboard.

### 4. Memória do projeto — Formalizar o fluxo canônico

Criar `mem://logic/quotation/fluxo-canonico-cotacao-8-etapas` com o texto exato das 8 etapas + regra "Cadastro nunca recebe contrato com cadastro_aprovado=true; ativação para 'ativo' é exclusiva do ativar-associado pós-monitoramento". Adicionar bullet em **Core**:
> Cadastro nunca recebe novamente proposta com `contratos.cadastro_aprovado=true`. Promoção a `status='ativo'` só via `ativar-associado` após Monitoramento. Devolução ao Cadastro só por bypass auditado de Diretor.

### 5. Validação das demais 7 etapas (já implementadas — apenas confirmar)

| Etapa | Implementação atual | Ação |
|-------|--------------------|------|
| 1. Link público + autovistoria por FIPE | OK (`finalizar-autovistoria-cotacao`, regra 2 fotos + vídeo 360°) | Nenhuma |
| 2. Cadastro com situação SGA | OK (gate `SituacaoFinanceiraGate` + `verificar-situacao-financeira-cadastro`) | Nenhuma |
| 3. Aprovação Cadastro → serviço de campo + atualização do link | OK (`aprovar-proposta` cria `servicos` + dispara `documentos_solicitados` quando aplicável) | Nenhuma |
| 4. Monitoramento vê serviço | OK (`useInstalacoesAguardandoAprovacao` filtra por `cadastro_aprovado=true`) | Nenhuma |
| 5. Atribuição + dispensa de vistoria sub-FIPE | OK (`vistoria-sem-rastreador-flow`) | Nenhuma — só validar |
| 6. Vistoria realizada (ou dispensada) | OK | Nenhuma |
| 7. Aprovação Monitoramento (direta ou pós-vistoria) | OK (`useAprovarInstalacaoMonitoramento` → `ativar-associado`) | Nenhuma |
| 8. Sai das filas, aparece em Associados/Veículos | **CORRIGIR** — itens 1–4 acima | — |

## Detalhes técnicos

```text
contratos.status flow canônico
─────────────────────────────────
rascunho → enviado → assinado → ativo
                       │
                       ├─ cadastro_aprovado=false  → fila Cadastro
                       └─ cadastro_aprovado=true   → fila Monitoramento
                                                     (NUNCA na fila Cadastro)
ativar-associado: assinado → ativo  (única transição válida)
```

### Migrations necessárias

1. Trigger `trg_protege_cadastro_aprovado` em `contratos`.
2. Função `fn_reconciliar_contratos_pos_monitoramento` + cron pg_cron (15 min).
3. (Opcional) Coluna `contratos.motivo_devolucao_cadastro text` para auditoria de devoluções de Diretor.

### Arquivos a editar

- `src/hooks/usePropostasPendentes.ts`
- `src/hooks/usePropostasPendentesCount.ts`
- `src/pages/cadastro/PropostasPendentes.tsx`
- `supabase/functions/aprovar-proposta/index.ts` (apenas log de reversão)
- Migration nova (trigger + cron + coluna opcional)
- `mem://logic/quotation/fluxo-canonico-cotacao-8-etapas` (nova memória) + atualização de `mem://index.md`

## Fora de escopo

- Refatoração das demais etapas (já validadas como OK).
- Mudança de UI do Monitoramento (continua igual).
- Alteração no fluxo de troca de titularidade (já segue o mesmo padrão via `aprovar-troca-cadastro`).
