

## Reinvestigando com a nova informação

Você está dizendo que o número `31 98429-6515` **nunca foi cadastrado** como WhatsApp. Só existe o `21 96412-8166` (telefone, que também é WhatsApp).

Isso muda o diagnóstico. Se o campo `whatsapp` no banco está com `31 98429-6515` e ninguém cadastrou esse número, então alguma coisa **gravou** esse valor lá. Preciso descobrir o quê.

## Hipóteses a verificar

1. **Webhook de entrada do WhatsApp sobrescrevendo o cadastro** — quando uma mensagem chega de um número, algum handler pode estar atualizando `associados.whatsapp` com o `from` da mensagem (lookup invertido por nome/CPF).
2. **Importação SGA/Hinova** — o sync pode ter trazido o número errado de outra base.
3. **Atualização manual via API externa** — `external-api-data-expansion` permite atualizar dados do associado.
4. **Trigger ou função no banco** que copia ou normaliza telefone para whatsapp.
5. **Confusão de associado** — o `associado_id` no `servicos` aponta para outra pessoa, e o "Adriano" que aparece é homônimo. Já confirmei que o nome bate, mas vale revisar CPF.
6. **Histórico de auditoria** — ver quando o campo `whatsapp` foi gravado pela última vez e por qual fonte.

## Plano de investigação (read-only)

### 1) Confirmar o estado atual e o histórico do registro
- Reler `associados` do Adriano: `id`, `nome`, `cpf`, `telefone`, `whatsapp`, `created_at`, `updated_at`.
- Verificar se existe tabela de auditoria (`audit_log`, `historico_associado`, etc.) com o histórico de mudança do campo `whatsapp`.
- Conferir se o `servico` do reagendamento aponta mesmo para esse `associado_id`.

### 2) Procurar quem escreve em `associados.whatsapp`
- `grep` por `\.update.*whatsapp` e `whatsapp:` em:
  - Edge Functions (`supabase/functions/*`)
  - Hooks de cadastro/edição (`src/hooks/*`)
  - Webhooks WhatsApp (`whatsapp-webhook`, `evolution-webhook`, `meta-webhook`)
  - Sync SGA (`sga-hinova-sync`)
  - API externa (`external-api*`)
- Identificar todos os pontos que podem ter sobrescrito o campo.

### 3) Inspecionar triggers no Postgres
- Listar triggers em `associados` para ver se algum normaliza/copia telefone.

### 4) Logs recentes
- Buscar nos logs das Edge Functions de webhook e sync por menções ao CPF/ID do Adriano nas últimas semanas, para datar quando o `31...` apareceu.

### 5) Decidir a correção com base no achado
Dependendo do culpado:
- **Se for webhook** → adicionar guarda para nunca sobrescrever `whatsapp` automaticamente sem confirmação.
- **Se for sync SGA** → revisar mapeamento de campo e priorizar o que já está cadastrado.
- **Se for API externa** → exigir flag explícita para atualizar `whatsapp`.
- **Se for trigger** → revisar a lógica.
- Em paralelo: corrigir o cadastro do Adriano (mover `21...` para `whatsapp`, limpar `31...`).

## O que eu entrego ao final

- Causa raiz exata de quem gravou `31 98429-6515` no campo `whatsapp`.
- Lista de todos os pontos do sistema capazes de sobrescrever esse campo.
- Recomendação de correção (código + dado).
- Guarda preventiva para não voltar a acontecer.

## Por que precisa do modo de execução

Em modo somente leitura eu já consigo ler banco, código e logs. A **correção** (código + UPDATE no cadastro) precisa de modo de edição. Aprovando este plano, sigo direto para a investigação completa e apresento as mudanças.

