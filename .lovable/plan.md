# Devolver caso ao Cadastro (em vez de só Reprovar)

## Contexto
No fix anterior (TIB8F32 e os 4 outros fantasmas pré-D1), o detalhe da Aprovação de Associados ficou com guard amarelo + **só "Reprovar"** disponível. O usuário aponta que reprovar não é correto: esses casos chegaram cedo demais à fila de Monitoramento. O caminho certo é **mandá-los de volta ao Cadastro** para o analista aprovar Roubo & Furto da autovistoria enxuta; o veículo continua aguardando a instalação técnica do rastreador e, quando o técnico fechar, volta ao Monitoramento normalmente.

## Comportamento alvo
Quando o guard `bloqueado=true` no `AprovacaoInstalacaoDetalhe` (servico não concluído / falta rastreador físico / autovistoria opcional acima FIPE sem instalação):
- **Esconder** o botão "Reprovar" (caso não-canônico aqui).
- **Mostrar** botão primário **"Devolver ao Cadastro"** (âmbar) com tooltip explicando o que vai acontecer.
- Clicar abre confirm dialog curto e, ao confirmar, chama a edge function `devolver-ao-cadastro`.
- Após sucesso: toast verde, invalida queries da fila e redireciona para `/monitoramento/aprovacao-associados`.

Reprovar fica disponível apenas quando **não** há guard ativo (caso o monitoramento legitimamente queira reprovar uma vistoria completa real).

## Backend — nova edge function `devolver-ao-cadastro`
Recebe `{ contrato_id, motivo?: string }`. Roda com service-role.

Fluxo:
1. Carrega contrato; valida que `cadastro_aprovado=true` e `status IN ('assinado','ativo')` (idempotência: se já `false`, retorna 200 noop).
2. **Reverte** em `contratos` (respeita `trg_protege_cadastro_aprovado` zerando ambos os campos):
   ```sql
   UPDATE contratos
      SET cadastro_aprovado=false,
          aprovado_por=NULL,
          aprovado_em=NULL,
          updated_at=now()
    WHERE id = :contrato_id;
   ```
3. **Reabre cotação** para a fila do Cadastro: `cotacoes.status_contratacao='aguardando_aprovacao_cadastro'` (preserva quando já estiver lá).
4. **Não toca** em: `servicos`, `instalacoes`, `vistorias`, R&F já liberado, rastreador físico. Apenas devolve a decisão ao Cadastro.
5. Registra em `auditoria_eventos` (ou tabela equivalente já usada) com `acao='devolver_ao_cadastro'`, ator, motivo e snapshot pré/pós.
6. Retorna `{ ok:true, contrato_id, novo_status_contratacao }`.

Erros tratados:
- 404 contrato inexistente.
- 409 `cadastro_aprovado_protegido` — converte exceção do trigger em mensagem clara ("aprovado_por/aprovado_em precisam ser nulos — bug interno, abrir ticket").
- 403 quando o usuário chamador não tem permissão de Monitoramento/Diretoria (checagem `app_roles_config`).

## Frontend — `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx`
Dentro do bloco que hoje renderiza o banner âmbar e o `Reprovar`:

```text
+-------------------------------------------------+
| ⚠ Aprovação ainda não liberada                 |
| (texto existente do motivo)                     |
| Esse caso deve voltar ao Cadastro para o        |
| analista aprovar Roubo & Furto; a aprovação     |
| final acontece após a instalação técnica.       |
+-------------------------------------------------+
[ ↩ Devolver ao Cadastro (aprovar R&F lá) ]   ← novo botão primário âmbar
```

- Componente novo `ConfirmarDevolverCadastroDialog` com textarea opcional "Motivo (interno)".
- Hook novo `useDevolverAoCadastro(contratoId)` (`useMutation` invocando `supabase.functions.invoke('devolver-ao-cadastro', { body: { contrato_id, motivo } })`).
- Em sucesso, `queryClient.invalidateQueries({ queryKey: ['aprovacao-associados'] })` + `['propostas-pendentes']` + `['cotacoes']`.
- Mantém o "Reprovar" apenas quando `!bloqueado`.

Reutiliza `exigeInstalacaoTecnica`, `veiculoSubFipe` já importados — sem nova lógica de elegibilidade.

## Permissões
Botão visível apenas para usuários com role de Monitoramento, Coordenador Monitoramento ou Diretoria (mesma regra atual de aprovar/reprovar — reaproveitar guard de role já existente na página).

## Memória
- Atualizar `mem://logic/operations/monitoramento-guard-aprovacao-sem-instalacao` substituindo "Reprovar restante" por "Devolver ao Cadastro" como ação canônica do guard.

## Out of scope
- Não cria nova tarefa de instalação automaticamente (já existe `instalacoes` + agendamento do cliente).
- Não envia mensagem ao cliente — pode ser fase 2 plugando no `useDevolverAoCadastro`.
- Não mexe nos triggers DB nem nos 5 registros históricos (eles passam a ser tratados pelo fluxo novo na próxima ação humana).

## Arquivos
- **Novo:** `supabase/functions/devolver-ao-cadastro/index.ts`
- **Novo:** `src/hooks/useDevolverAoCadastro.ts`
- **Novo:** `src/components/monitoramento/ConfirmarDevolverCadastroDialog.tsx`
- **Alterar:** `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx` (esconder Reprovar quando bloqueado; render do novo botão; integrar hook/dialog; ajustar copy do banner)
- **Alterar:** `mem://logic/operations/monitoramento-guard-aprovacao-sem-instalacao.md`
