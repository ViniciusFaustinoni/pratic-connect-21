# Causa raiz

A query da aba **Serviços Pendentes / Atribuição Manual** lista todo serviço com `profissional_id IS NULL` e `status IN ('pendente','agendada')`.

No fluxo de prestador externo (`useAtribuirServicoPrestador`):
- Cria o link na `instalacao_prestador_links` (via edge `gerar-link-prestador` / `gerar-link-vistoriador-prestador`).
- Insere log em `servicos_atribuicoes_log`.
- **Nunca atualiza o registro em `servicos`** (não muda `profissional_id`, não muda `status`).

Resultado: o serviço continua aparecendo como pendente até o prestador concluir a instalação (que zera via outro fluxo). Pior — durante a janela de execução, qualquer coordenador pode reatribuí-lo. Confirmado no LMX5A90: existem **dois links** para a mesma instalação (`b40587c8` concluído pelo SHALOM e `bcc1af41` ainda `aguardando` em outro prestador).

Diferente do fluxo interno (`useAtribuirServicoManual`), que faz `UPDATE servicos SET profissional_id=…, status='agendada'` e portanto remove da fila imediatamente.

# Solução

## 1. Atualizar `servicos` na atribuição a prestador
Em `src/hooks/useAtribuicaoManual.ts → useAtribuirServicoPrestador`, após o link ser gerado com sucesso e antes do log:

- `UPDATE servicos SET status='agendada', updated_at=now() WHERE id=servicoId`.
- Não setar `profissional_id` (coluna FK para `profiles` interno; prestador não tem profile). Em vez disso, marcar o vínculo via `status='agendada'` + a presença do link em `instalacao_prestador_links` (já é a fonte canônica).

## 2. Ajustar a query de `Serviços Pendentes`
Em `useServicosParaAtribuir`, filtrar também serviços que já tenham link de prestador ativo:

```text
status='pendente' AND profissional_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM instalacao_prestador_links l
  JOIN instalacoes i ON i.id = l.instalacao_id
  WHERE i.veiculo_id = servicos.veiculo_id
    AND l.status IN ('aguardando','aceito','em_rota','iniciada','em_execucao','concluida')
)
```

Implementação em duas fases:
- (a) buscar `instalacao_prestador_links` ativos do dia em uma query e fazer set-difference no client (mais simples, sem RPC).
- (b) filtrar pelo status do serviço em `('pendente')` ao invés de `('pendente','agendada')`, já que após o passo 1 a presença de prestador resulta em `agendada`.

## 3. Bloquear reatribuição com link ativo
No `useAtribuirServicoPrestador`, antes de chamar a edge function: verificar se já existe link ativo (`status NOT IN ('concluida','cancelado','expirado','recusado')`) para a mesma `instalacao_id`. Se existir, abortar com mensagem clara: "Já há um prestador atribuído a este serviço. Cancele/devolva antes de reatribuir."

## 4. Sincronizar quando link cancelado/expirado
Quando um link de prestador é cancelado, expirado ou recusado, o serviço precisa voltar para `status='pendente'`. Adicionar um trigger em `instalacao_prestador_links` (AFTER UPDATE) que:
- Se `status` mudar para `cancelado/expirado/recusado` e não existir outro link ativo para a mesma instalação → `UPDATE servicos SET status='pendente' WHERE instalacao_origem_id = link.instalacao_id`.
- Se `status` mudar para `concluida` → `UPDATE servicos SET status='concluida'` (defesa em profundidade; a edge `concluir-instalacao-prestador` já faz isso indiretamente).

## 5. Backfill imediato
Para o LMX5A90 (e qualquer outro caso travado):
- Cancelar o link `bcc1af41` (ainda `aguardando`) que sobrou após o SHALOM concluir.
- Garantir `servicos.status='concluida'` para `cc991c24` (já está) — só limpar a fila visualmente.
- Varrer `servicos` com `status IN ('pendente','agendada')` cujo link ativo está concluído e marcar como `concluida`.

# Detalhes técnicos

**Arquivos a editar**:
- `src/hooks/useAtribuicaoManual.ts` — passos 1, 2, 3.
- Migration nova — passo 4 (trigger) e passo 5 (DML backfill).

**Por que não usar `profissional_id` para prestador**: a FK aponta para `profiles` (técnicos internos). Prestador externo vive em `vistoriadores_prestadores` / `prestadores_assistencia`. Usar `status='agendada'` + presença do link é o caminho consistente com o fluxo já existente em `concluir-instalacao-prestador`.

**Memória a registrar**: nova entry em `mem://logic/operations/atribuicao-prestador-status-sync` documentando: "Atribuir a prestador externo OBRIGATORIAMENTE muda servicos.status para 'agendada' e exige checagem de link ativo antes de gerar novo link."
