## Problema

A mensagem da screenshot foi enviada via template `sinistro_atualizado`:

> "Olá {{1}}, há uma atualização no seu sinistro {{2}}: {{3}}. Acompanhe pelo app."

Disparado em `supabase/functions/autentique-webhook/index.ts:457`, quando o titular anterior assina o termo de cancelamento da troca de titularidade. O template foi reaproveitado como "catch-all" para 15+ contextos não-sinistro (troca de titularidade, retirada, vistoria prestador, cobrança, encaixe, atribuição, asaas webhook, cron expirar, etc.) — o que produz mensagens factualmente erradas como a recebida pelo Vinícius.

Lista completa de pontos que usam `sinistro_atualizado` hoje (todos vão migrar):
- `autentique-webhook` (troca titularidade — caso reportado)
- `efetivar-troca-titularidade` (via `_shared/troca-pos-cadastro-bg.ts`)
- `concluir-instalacao-prestador`, `concluir-vistoria-prestador`
- `confirmar-retirada`, `criar-chamado-assistencia`
- `retroativo-pagamento-termo`, `asaas-webhook`
- `atribuir-proxima-tarefa`, `cron-expirar-confirmacoes`, `cron-contato-sinistro`
- `aprovar-solicitacao-ia` (2 sites), `disparar-notificacao` (3 sites)
- `aprovar-sinistro`, `reprovar-sinistro` (esses sim são contexto sinistro real)
- Fallback automático em `whatsapp-send-text/index.ts`

## Solução

Criar novo template neutro `notificacao_atualizacao` (UTILITY, pt_BR) e migrar todas as chamadas — inclusive as de sinistro real, já que o novo nome é genérico o suficiente para servir aos dois casos.

### Corpo do novo template

```
Olá {{1}}, há uma atualização no seu atendimento {{2}}: {{3}}. Acompanhe pelo app.
```

Variáveis-exemplo: `{"1":"Ana","2":"COT-2026-0001","3":"Troca de titularidade liberada"}`.
Rodapé: `Pratic Car`. Sem botões (mantém compatibilidade — o link já vai dentro de {{3}}, como já acontece hoje).

### Passos

1. **Migration** — inserir `notificacao_atualizacao` em `whatsapp_meta_templates` com `status='PENDING'`, `disparo_habilitado=true`.

2. **Submeter à Meta** — invocar `whatsapp-meta-templates` (action de submit/recriar) passando o id do novo template. Aguardar status mudar para `APPROVED` antes de migrar os call sites em produção (a migração de código pode ir junto, mas o template antigo segue como fallback até a Meta aprovar).

3. **Substituir call sites** — `rg -l "template_name: 'sinistro_atualizado'"` em `supabase/functions/` e trocar por `'notificacao_atualizacao'` em TODOS os arquivos listados acima. Atualizar também:
   - `supabase/functions/whatsapp-send-text/index.ts` linhas 164 e 266 (`fallbackOrder` e auto-fallback).
   - `src/lib/whatsapp/template-catalog.ts` (entrada `sinistro_atualizado` vira deprecated + nova entrada `notificacao_atualizacao`).
   - `src/hooks/useAssociadoHistoricoCompleto.ts` linha 42 (mapping).

4. **Desativar antigo** — `UPDATE whatsapp_meta_templates SET disparo_habilitado=false WHERE nome='sinistro_atualizado'` (respeita a regra `mem://logic/integrations/whatsapp-template-disparo-toggle`: gate local sem mexer no status Meta; mantém o registro APPROVED para histórico/auditoria mas bloqueia novos disparos).

5. **Memória** — atualizar `mem://logic/integrations/whatsapp-template-disparo-toggle` com nota de que `sinistro_atualizado` foi aposentado em favor de `notificacao_atualizacao`, e registrar a regra: "templates Meta não devem ser reusados em contexto de domínio diferente do nome".

### Ordem de execução proposta

1. Migration cria `notificacao_atualizacao` (PENDING) + desativa toggle de `sinistro_atualizado`.
2. Edge function submete novo template à Meta.
3. Code edits trocam todas as referências de `sinistro_atualizado` → `notificacao_atualizacao` (inclusive fallback).
4. Memória atualizada.

Enquanto a Meta não aprovar, o `whatsapp-send-text` vai falhar para esses disparos (já que toggle do antigo está off). Alternativa: manter `disparo_habilitado=true` no antigo até a Meta aprovar o novo, e só então desativar. **Recomendo esta variante** para evitar janela de silêncio em produção — incluo isso no passo 4 (desativação fica condicional à aprovação Meta, em uma segunda migration curta).

### Não escopo

- Não cria templates novos para cada contexto (troca, vistoria, retirada, etc.) — escopo seria muito maior. O template neutro cobre todos os casos.
- Não altera fluxo de geração de link/conteúdo da mensagem — só o nome do template Meta usado para entregar.