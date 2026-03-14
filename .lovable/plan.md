
Diagnóstico do caso do associado **Marcos Vinícius Faustinoni** (instalação `8eb8cd9e...` / serviço `539f439f...`):

### 1) O que os logs e payloads mostram
- O serviço estava **elegível para encaixe**:
  - `servicos.id = 539f...`
  - `status = agendada`
  - `profissional_id = null`
  - `instalacao_origem_id = 8eb8...`
  - instalação com `permite_encaixe = true`, coordenadas preenchidas.
- Havia profissional disponível:
  - `vistoriador_id = 68f4857b...`
  - `em_servico = true`, localização recente.
- Fluxo automático tentou atribuir corretamente (cron + polling):
  - `Tentando atribuir instalacao 539f... (7.20 km, tipo: encaixe)`
  - `⚡ ENCAIXE EXECUTADO... de 2026-03-16 para 2026-03-14`
- Falha real (repetida):
  - erro `42804`:  
    `column "status" is of type status_servico but expression is of type status_instalacao`

### 2) Motivo real (causa raiz)
A causa é **quebra de trigger de sincronização** no banco (não é regra de negócio nem indisponibilidade de instalador).

Função atual no banco:
- `public.sync_instalacao_update_to_servicos()`
- está fazendo:
  - `status = NEW.status`
- `NEW.status` vem de `instalacoes` (enum `status_instalacao`)
- `servicos.status` é enum `status_servico`
- Isso gera incompatibilidade de tipos e **aborta a transação** da atribuição.

Origem da regressão:
- migração `20260314204513_6d539274...sql` (ajuste de coordenadas) recriou os triggers com esse `status = NEW.status` sem cast/mapeamento.

### 3) Por que “acontece várias vezes”
Porque o app/cron continua tentando o mesmo serviço:
- `atribuir-proxima-tarefa` (polling frequente)
- `cron-atribuir-tarefas`
- `processar-encaixes-automaticos`

Como a trigger está quebrada, **todas as tentativas falham igual**.  
Além disso, `processar-encaixes-automaticos` mascara erro técnico como “já foi atribuído por outro processo”, dificultando diagnóstico.

### 4) Plano objetivo de correção (para não quebrar outros fluxos)
1. **Corrigir triggers de sync origem → servicos**:
   - `sync_instalacao_update_to_servicos`
   - `sync_vistoria_update_to_servicos`
   - usar cast seguro via texto + mapeamento explícito para `status_servico` (não atribuição direta de enum).
2. **Padronizar mapeamento de status** em função única (evitar regressão em futuras migrações).
3. **Corrigir observabilidade**:
   - em `processar-encaixes-automaticos`, logar `updateError.code/message/details` antes de classificar como concorrência.
4. **Teste de regressão obrigatório** (E2E técnico do fluxo automático):
   - criar instalação com `permite_encaixe=true`
   - rodar atribuição automática
   - validar que `servicos.profissional_id` e `instalacoes.instalador_responsavel_id` são preenchidos sem erro 42804.
5. **Validação pós-fix no caso atual**:
   - reprocessar `servico 539f...` e confirmar atribuição automática efetiva.

### 5) Conclusão executiva
O problema **não** está no associado, no encaixe, nem no profissional disponível.  
O bloqueio é **estrutural no banco**: trigger com atribuição de enum incompatível (`status_instalacao` → `status_servico`) introduzida em migração recente.
