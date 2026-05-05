
## Caso RKL6I08 — diagnóstico

Verifiquei o estado atual no banco:

- `servicos.id db658f9d…` — `tipo=instalacao`, `status=em_analise`, `decisao_instalador=negado`, ressalva preenchida ("Sistema elétrico comprometido…").
- `instalacoes.id 3cbd44ea…` — `status=em_analise` (não foi fechada).
- `veiculos RKL6I08` — `status=instalacao_pendente`, `cobertura_suspensa=false`.
- Não há nenhum outro `servicos` ativo para este veículo / este profissional.

A RPC `buscar_tarefa_atual_profissional` já filtra apenas `em_rota|em_andamento|agendada`, então o card "Tarefa Atual" do técnico não deveria mais retornar este serviço — o que de fato acontece após refetch.

O comportamento que o usuário relata como "o sistema continua forçando a instalação" vem de **dois pontos colaterais que não são tratados na negativa**:

1. O registro em `instalacoes` continua aberto (`em_analise`), então:
   - aparece em listas de instalações pendentes do monitoramento como se ainda fosse executável;
   - o técnico ainda enxerga a placa no detalhe da instalação se acessar pelo link direto.
2. O veículo permanece com `status=instalacao_pendente` exibindo no app do associado a mensagem "Aguardando agendamento da instalação do rastreador" — ou seja, na visão do cliente o sistema "ainda exige" a instalação.

O fluxo correto: ao negar, o serviço cai em `em_analise/negado` (já implementado) e as instâncias derivadas precisam acompanhar. A reativação só pode vir do monitoramento via `/monitoramento/aprovacoes-monitoramento → Recusas do Instalador`.

## Plano

### 1. Atualizar `useRecusarVeiculoServico` (front)

Quando o técnico nega o serviço, além de marcar `servicos.decisao_instalador='negado'`, fazer em transação:

- `instalacoes` referenciada (via `instalacao_origem_id` do serviço) → `status='em_analise_recusa'` (novo valor), `observacoes` acrescidas do motivo;
- `veiculos.status` → `em_analise` (com `cobertura_suspensa=true`, motivo "Recusa do instalador — aguardando análise"), para o app do cliente parar de pedir instalação e exibir "Documentação em análise";
- Manter o `agendamentos_base` deduplicado (já existe trigger `trg_sync_agendamento_base_on_servico_terminal`, mas `em_analise` não é terminal — vamos chamar manualmente o fechamento da linha do agendamento ligada à instalação).

### 2. Atualizar resolução do monitoramento (`useRecusasInstalador`)

Quando o monitoramento decide:

- **Aprovado com ressalva** → reabrir: `instalacoes.status='agendada'`, `veiculos.status='instalacao_pendente'`, limpar `cobertura_suspensa`, limpar `decisao_instalador` no serviço (já feito) e disparar reagendamento.
- **Recusa confirmada** → encerrar: `instalacoes.status='cancelada'`, `veiculos.status='reprovado'` (ou `cancelado` conforme regra existente), manter cobertura suspensa e abrir o fluxo de cancelamento/restituição já existente.

### 3. Migração SQL

- Adicionar valor `em_analise_recusa` ao enum/coluna `instalacoes.status` (apenas se for enum; caso seja text, sem migração).
- Trigger `fn_sync_veiculo_on_servico_negado` em `servicos AFTER UPDATE`: quando `decisao_instalador` muda para `negado`, faz o sync acima como salvaguarda, garantindo que mesmo chamadas legadas/edge funcs respeitem o novo estado.

### 4. Reprocessar registros órfãos (script único)

Para o caso atual (RKL6I08) e quaisquer outros já em produção:

```sql
UPDATE veiculos v
   SET status='em_analise',
       cobertura_suspensa=true,
       cobertura_suspensa_motivo='Recusa do instalador — aguardando análise',
       cobertura_suspensa_em=now()
  FROM servicos s
 WHERE s.veiculo_id=v.id
   AND s.decisao_instalador='negado'
   AND s.status='em_analise'
   AND v.status='instalacao_pendente';

UPDATE instalacoes i
   SET status='em_analise',
       observacoes = COALESCE(i.observacoes,'') || E'\n[Negada pelo instalador — aguardando monitoramento]'
  FROM servicos s
 WHERE s.instalacao_origem_id=i.id
   AND s.decisao_instalador='negado'
   AND i.status NOT IN ('cancelada','concluida','aprovada');
```

### 5. UX

- No app do cliente (`CardVeiculo`): para `em_analise` causado por recusa de instalador, exibir mensagem específica "Aguardando análise do monitoramento — não é necessário reagendar agora".
- Na tela "Recusas do Instalador" (já existente em Aprovações do Monitoramento), continuar como única porta de saída para reabrir/cancelar.

## Arquivos previstos

- `src/hooks/useServicos.ts` — `useRecusarVeiculoServico` passa a executar os 3 updates atômicos.
- `src/hooks/useRecusasInstalador.ts` — fechar/reabrir `instalacoes` + `veiculos` na decisão.
- `src/components/app/CardVeiculo.tsx` — mensagem específica.
- `supabase/migrations/*` — trigger `fn_sync_veiculo_on_servico_negado` + script de backfill.

Sem novos secrets. Nenhuma edge function nova. Nenhuma quebra de rota.
