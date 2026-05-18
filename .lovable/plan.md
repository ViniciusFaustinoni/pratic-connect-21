## Diagnóstico

ANDRE e ROMARIO foram saneados indevidamente porque a varredura do Lote A não filtrou pelo critério canônico de órfão:

- **Órfão real** = autovistoria + contrato `ativo` + sem rastreador + **sem `instalacoes` agendada/concluída**
- **Caso legítimo (FIPE acima, autovistoria opcional)** = autovistoria + contrato `ativo` + sem rastreador AINDA + **instalação técnica `agendada` em `instalacoes`** → fluxo correto, aguarda visita do técnico para concluir e Monitoramento aprovar.

ANDRE e ROMARIO se encaixam no segundo caso. André tem instalação `agendada` para 19/05 manhã (e segundo o usuário, já foi feita fisicamente — falta apenas baixar no sistema). Romário tem instalação `agendada` para 18/05 tarde.

## Mudanças

### 1. Migration — desfazer saneamento desses 2 contratos

Para ANDRE (`5be6bc5d-3e76-4fdf-ba33-9b33af058f35`) e ROMARIO (`8641bf11-f0ff-4b8b-954f-6e58ad49c456`):

```text
contratos.cadastro_aprovado  → true
contratos.aprovado_por       → <user diretor sentinel> (perdi o original ao zerar)
contratos.aprovado_em        → now()
contratos.status             → mantém 'assinado'  (instalação ainda não concluída no sistema)
veiculos.status              → mantém 'instalacao_pendente'
associados.status            → 'aguardando_instalacao'
```

Saem da fila do Cadastro e passam a aparecer corretamente na fila de Instalação/Monitoramento.

### 2. Cancelar reenfileiramento SGA errado

`UPDATE integration_retry_queue SET status='dead_letter', last_error='saneamento_revertido_caso_legitimo'` para os 4 registros (`correlation_id` = associado_id ou veiculo_id desses 2) que ainda estão `status='pending'`. Evita re-sync indevido para PENDENTE no Hinova de associados que já estavam corretamente em fluxo de instalação.

### 3. Corrigir varredura futura — registrar regra na memória

Atualizar `mem://logic/operations/autovistoria-acima-fipe-libera-rf-nao-conclui-vistoria` adicionando o critério oficial para identificar órfão "autovistoria-promove-cadastro":

> Órfão real só quando NÃO existe registro em `instalacoes` (qualquer status que não seja `cancelada`) nem `servicos.tipo IN ('instalacao','vistoria_entrada')` com `status NOT IN ('cancelada','reprovada')` que justifique presença na fila técnica.

### Fora do escopo desta correção (sinalizo, mas não trato agora)

- **André já foi instalado fisicamente** mas `instalacoes.concluida_em` está NULL. Concluir essa instalação no sistema (com fotos, IMEI vinculado etc.) é fluxo operacional normal pelo painel — não automatizo aqui. Se o usuário quiser, posso depois criar uma ação específica para "baixar instalação executada offline" no caso do ANDRE.
- Inconsistência menor: `servicos.tipo='instalacao'` desses dois tem `status='agendada'` mas `concluida_em` preenchido (timestamp da criação do serviço). Não afeta UI agora — deixar como está.

## Detalhes técnicos

- Trigger `trg_protege_cadastro_aprovado` só bloqueia `true→false`; `false→true` é livre.
- `aprovado_por` precisa apontar para um `auth.users` existente. Usar primeiro usuário com role `diretor` como sentinel (já é padrão em outros saneamentos).
- Sem alterações em código de aplicação / edge functions — fluxo legítimo já existe e estava funcionando antes do meu saneamento.

## Confirmação

Pode prosseguir? Vou aplicar 1 migration: reverter ANDRE+ROMARIO + dead_letter dos retry SGA correspondentes. Sem mexer nos outros 3 (TTX4J73, CAIO, MARLON — esses continuam corretamente saneados).
