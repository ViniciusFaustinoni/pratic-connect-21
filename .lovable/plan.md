## Objetivo

Quando o `sga-hinova-sync` detectar que a placa/chassi do nosso associado já está cadastrada em **outro** `codigo_associado` no Hinova, e existir prova local de que aquela placa foi transferida (`solicitacoes_troca_titularidade.status='efetivada'` para o mesmo `veiculo_id`), inativar o veículo do titular remoto no SGA (situação **2**) automaticamente e seguir o cadastro do novo titular.

Sem prova local, manter o comportamento atual (`markQueueFalhaPermanente`) — operador resolve no painel SGA.

Adicionalmente: executar o caso da **BRUNA NASCIMENTO / RFL7J00** agora, mesmo sem registro local de troca, via one-off auditado.

---

## Mudança 1 — Guard automático no `sga-hinova-sync`

**Arquivo:** `supabase/functions/sga-hinova-sync/index.ts`

**Localização:** branches `conflito_placa` (linhas 754–764) e `conflito_chassi` (linhas 780–792).

**Antes** de chamar `markQueueFalhaPermanente`, executar:

```text
1. Consultar solicitacoes_troca_titularidade onde:
     veiculo_id = _vid (nosso registro local)
     status = 'efetivada'
   LIMIT 1
2. Se NÃO encontrar → manter comportamento atual (falha_permanente). Fim.
3. Se encontrar:
     a) Chamar alterarSituacaoParaVeiculoHinova(supabase, r.found.codigo_veiculo, 2)
        → endpoint canônico já existente em _shared/hinova-client.ts:1538
     b) Logar em sga_sync_logs (ação 'auto_inativar_veiculo_remoto')
     c) Se OK: zerar codigoVeiculoHinova, NÃO retornar, deixar o fluxo cair em
        "6.d Cadastrar se não existe" → veículo nasce vinculado ao novo titular
     d) Se falhar: markQueueFalhaPermanente com mensagem "Auto-inativação falhou: ..."
        (mantém status atual de erro, operador inspeciona)
```

**Salvaguardas:**
- Reaproveita `alterarSituacaoParaVeiculoHinova` (já mapeada para `GET /veiculo/alterar-situacao-para/2/:codigo`) — nenhum endpoint novo.
- Não usa o endpoint de Vistoria mencionado pelo usuário (não é necessário; situação 2 = inativo é exatamente o que libera a placa).
- Auditoria via `logSync` + `insertAuditLog` (acao='atualizar', descrição com placa + ambos codigo_associado + codigo_veiculo).

---

## Mudança 2 — One-off para BRUNA / RFL7J00

Como não existe `solicitacoes_troca_titularidade` local para a BRUNA, o guard novo **não** vai destravá-la sozinho. Vai executar uma vez, manualmente:

**Script ad-hoc executado via `code--exec` (não é nova edge function):**

1. `buscarVeiculoPorPlaca` → obter `codigo_veiculo` remoto do 22638 para a placa RFL7J00 (confirma o conflito).
2. Chamar via `supabase--curl_edge_functions` uma invocação direta do `sga-hinova-sync` em modo "force" **OU** simplesmente:
   - Executar SQL para inserir um marker temporário em `sga_sync_queue` reiniciando attempts/status
   - E, antes disso, chamar o endpoint Hinova de inativação via uma chamada curl autenticada (reaproveitando a sessão Hinova da própria função `sga-hinova-sync` — abordagem mais simples: rodar uma edge function one-off `oneoff-sga-inativar-veiculo` apenas para essa execução, deletada depois).

**Decisão proposta:** edge one-off `oneoff-sga-inativar-veiculo-remoto` (temporária):
- Body: `{ placa, motivo, executor_user_id }`
- Confirma `placa` existe localmente em outro associado (no Hinova).
- Chama `alterarSituacaoParaVeiculoHinova(..., 2)`.
- Reseta `sga_sync_queue` do veículo local (status='pendente', attempts=0, ultimo_erro=null).
- Loga em `logs_auditoria` (acao='atualizar', tipo='sga_one_off').
- Retorna `{ ok, codigo_veiculo_remoto_inativado, requeued }`.

Após validação da BRUNA, **deletar a função** (`supabase--delete_edge_functions`). Não fica vestígio no projeto.

**Execução para BRUNA:**
- Invocar a one-off com `{ placa: "RFL7J00", motivo: "Troca de titularidade legada — Bruna Nascimento", executor_user_id: <user_atual> }`.
- Observar logs.
- Disparar `sga-hinova-sync` para a BRUNA e verificar conclusão.

---

## Atualizações de memória

Acrescentar à memória `mem://infrastructure/integrations/sga-sync-queue-canonical` (ou criar `mem://logic/integrations/sga-conflito-placa-auto-inativar`):

- Quando placa/chassi conflita no Hinova com outro `codigo_associado`, `sga-hinova-sync` **só** auto-inativa o veículo remoto (situação 2) se houver `solicitacoes_troca_titularidade.status='efetivada'` local para o mesmo `veiculo_id`.
- Trocas legadas / externas (sem registro local) continuam exigindo intervenção manual no painel SGA.
- Endpoint canônico: `alterarSituacaoParaVeiculoHinova(_, codigo_veiculo, 2)` — nunca usar o endpoint de Vistoria para isto.

---

## Fora de escopo

- Auto-inativação por chassi sem troca local (descartado pelo usuário).
- Backfill em massa de outros conflitos parados em `falha_permanente`.
- Mudanças no `efetivar-troca-titularidade` (já chama `alterarSituacaoVeiculoHinova` para inativar o veículo do antigo titular no fluxo canônico — ver linha 1165).

---

## Validação

1. **BRUNA / RFL7J00:** após o one-off + requeue, `sga_sync_queue` para o veículo `a180e267…` vai a `concluido`; `veiculos.codigo_hinova` da BRUNA passa a existir; tela `/configuracoes/integracoes/sga-hinova?placa=RFL7J00` mostra sucesso.
2. **Guard novo:** simular uma troca futura criando manualmente um conflito (ou aguardar próximo caso real); confirmar log `auto_inativar_veiculo_remoto` + cadastro do novo titular concluído na mesma execução.
3. **Sem troca local:** conflito segue para `falha_permanente` como hoje (comportamento preservado).
