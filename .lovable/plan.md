
## Diagnóstico (caso real: COT-20260509-184816784-883 / RIQUELME / Marcio Brasil)

Estado atual no banco:
- `cotacoes.status = 'aceita'`, `status_contratacao = 'pagamento_ok'`, `tipo_vistoria='agendada'`, `tipo_instalacao='rota'`, `cenario_adesao='isenta_rota'`.
- **Todos os campos `vistoria_*` (data, horário, endereço, responsável) estão NULL.**
- `contratos.status='assinado'`, `cadastro_aprovado=true`, autentique `signed`, adesão paga.
- `vistorias`, `instalacoes`, `agendamentos_base` e `servicos` para esta cotação: **0 registros**.

Por que sumiu da fila de monitoramento:
1. A tela pública (`src/pages/public/CotacaoContratacao.tsx`, linhas ~1186–1204) tem um **fallback silencioso**: quando `tipo_vistoria='agendada'` mas `vistoria_data_agendada` é nulo, exibe um card genérico "Agendamento Confirmado! Aguarde o contato do vistoriador" — **sem nunca abrir o formulário de agendamento e sem criar nada em `vistorias`/`instalacoes`/`agendamentos_base`**.
2. `aprovar-proposta` chama `criar-instalacao-pos-pagamento` como fallback, mas essa função (linhas 286–304) lê `vistoria_data_agendada` da cotação — como está nulo, **não cria instalação** (log "tipo_vistoria=agendada sem data").
3. Com `cadastro_aprovado=true`, a regra "Propostas Pendentes saída por vistoria" remove o contrato da fila de Propostas Pendentes; e como não existe instalação/vistoria/agendamento, ele também **não entra** em Monitoramento › Aprovações › Aprovação de Associados (que só lista quando há instalação/vistoria concluída).
4. Resultado: contrato em limbo. O cliente vê sucesso, o vendedor vê sucesso, e o monitoramento não tem nada para atribuir.

Por que afeta mais vendedores externos: o consultor externo costuma rodar a cotação pelo painel interno (marcando dados básicos), gerar contrato e aprovar adesão, **pulando a etapa "Vistoria/Agendamento" do link público**. Em fluxos onde o próprio cliente acessa o link, ele preenche a vistoria normalmente. No fluxo externo, ele cai direto na tela-fantasma.

## Correções

### 1. Frontend — eliminar tela-fantasma (`src/pages/public/CotacaoContratacao.tsx`)
- Remover o bloco de fallback "Agendamento Confirmado" genérico (linhas ~1186–1204).
- Quando `tipo_vistoria='agendada'` e `vistoria_data_agendada` é nulo **e** não há vistoria/instalação/agendamento_base existentes, renderizar o componente real de agendamento (`AgendamentoVistoria` / `AgendamentoCotacao` com `contexto='presencial-direto'`), passando `tipoInstalacao` da cotação para já filtrar Base × Rota corretamente (memória de fluxo de adesão isenta).
- Só exibir o card "Vistoria Agendada com Sucesso" quando `vistoria_data_agendada` estiver preenchido **ou** `hasVistoriaAgendada/hasInstalacaoAgendada/hasAgendamentoBase` for true.

### 2. Backend — barrar aprovação sem agendamento (`supabase/functions/aprovar-proposta`)
- Após o fallback `criar-instalacao-pos-pagamento`, se ainda não existir `instalacaoCriadaId` **nem** `agendamentos_base` ativo **nem** `vistorias` para a cotação, **não** marcar `cadastro_aprovado=true` no contrato. Em vez disso:
  - Manter o contrato visível em "Propostas Pendentes" com badge "Aguardando agendamento de vistoria".
  - Disparar notificação ao vendedor (WhatsApp/notificação interna) com o link público para o cliente concluir a etapa Vistoria.
- Logar `aprovar-proposta_no_schedule` em `logs_auditoria` para visibilidade.

### 3. Migration de recuperação (one-shot)
Para todos os contratos com `cadastro_aprovado=true`, `status='assinado'`, sem `instalacoes`/`vistorias`/`agendamentos_base` ativos e cotação com `tipo_vistoria='agendada'` e `vistoria_data_agendada IS NULL`:
- Reverter `cadastro_aprovado=false` para reentrar em Propostas Pendentes.
- Inserir tarefa em `logs_auditoria` (ação=`recuperacao_limbo_agendamento`).
- Para o caso específico do RIQUELME (cotação `994f6018…` / contrato `3d4ce412…`), aplicar o mesmo tratamento — vendedor receberá link para concluir agendamento.

### 4. Painel de monitoramento (sentinela)
Adicionar à aba "Aprovação de Associados" (ou criar bloco "Contratos sem agendamento") um indicador automático para casos novos:
- Query: contratos `assinado` há mais de 2h sem instalação/vistoria/agendamento.
- Botão "Forçar agendamento" que abre modal interno (mesmo formulário) e chama `criar-instalacao-pos-pagamento` com os dados informados.

## Arquivos afetados (estimativa)

```text
src/pages/public/CotacaoContratacao.tsx          [editar — remover fallback, plugar form]
supabase/functions/aprovar-proposta/index.ts     [editar — guard de cadastro_aprovado]
supabase/migrations/<novo>.sql                   [criar — recovery + log]
src/pages/monitoramento/AprovacoesUnificadas.tsx [editar — add bloco sentinela]
src/components/monitoramento/<novo>.tsx          [criar — ContratosSemAgendamento]
```

## Detalhes técnicos

- O `useAgendamentoExistente` já retorna `hasVistoriaAgendada/hasInstalacaoAgendada/hasAgendamentoBase`; basta usar para decidir entre formulário e card de sucesso.
- `tipo_instalacao` da cotação (`'rota'` para isenta_rota, `'base'` para isenta_base) precisa ser propagado ao `AgendamentoVistoria` para já esconder a opção contraditória (já implementado em outros pontos pela memória `EscolhaLocalVistoria`).
- A guarda em `aprovar-proposta` usa exatamente as três tabelas listadas no `useAgendamentoExistente` para consistência.
- A migration de recovery não toca `autentique_status`, `adesao_paga` nem `data_assinatura` — apenas `cadastro_aprovado`.

## Resultado esperado

- Vendedor externo não consegue mais "fechar" a venda sem capturar data/horário/endereço da vistoria.
- Cliente que cair em fluxo público sem agendamento vê o formulário, não o card-fantasma.
- Contratos órfãos são detectados e voltam à fila operacional.
- O caso do RIQUELME volta a ser visível e processável.
