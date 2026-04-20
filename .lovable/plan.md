

## Diagnóstico — Por que a flag "Atribuição Manual" está sendo ignorada

A flag `atribuicao_manual_rotas` está como `true` no banco (confirmado via consulta), mas **3 motores automáticos não a respeitam**. Cada um foi escrito de forma isolada e só `processar-encaixes-automaticos` faz o check correto.

### Motores que ignoram o switch

| # | Edge Function | Comportamento atual | Quando dispara |
|---|---|---|---|
| 1 | `cron-atribuir-tarefas` | Comentário explícito ignorando a flag (linhas 110-113). Só checa `fila_atribuicao_ativa`. | A cada 5 min via cron |
| 2 | `atribuir-proxima-tarefa` | Nenhum check da flag. Atribui próxima tarefa quando técnico conclui uma. | Invocado ao concluir serviço / aceitar |
| 3 | `cron-reagendamento-automatico` (Parte 1 — órfãos) | Atribui órfãos diretamente ao mais próximo (linhas 112-118). | A cada 5 min via cron |
| 4 | `criar-instalacao-pos-pagamento` | Invoca `cron-atribuir-tarefas` ao criar instalação pós-pagamento. | Webhook de pagamento aprovado |
| 5 | `processar-encaixes-automaticos` | ✅ Já respeita a flag (linhas 130-136). | Modelo a seguir |

### Causa direta no caso do print
O técnico Kleytonn recebeu uma reagendamento "automaticamente após o horário". O fluxo provável: associado reagendou via link público → `reagendar-vistoria-publica` setou status `agendada` → `cron-atribuir-tarefas` rodou no ciclo seguinte → atribuiu ao Kleytonn ignorando o switch.

---

## Plano de correção

### 1) Helper compartilhado para checar a flag
Adicionar no início de cada edge function abaixo o mesmo bloco já usado em `processar-encaixes-automaticos`:

```ts
const { data: configManual } = await supabase
  .from('configuracoes')
  .select('valor')
  .eq('chave', 'atribuicao_manual_rotas')
  .maybeSingle();

if (configManual?.valor === 'true') {
  console.log('[<fn-name>] Atribuição MANUAL ativa — atribuição automática desligada');
  return new Response(
    JSON.stringify({ resultado: 'manual_ativo', mensagem: 'Atribuição manual ativa — pulando' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### 2) Aplicar em cada motor

**a) `supabase/functions/cron-atribuir-tarefas/index.ts`**
- Remover o comentário "NOTA: A flag … NÃO bloqueia mais o motor automático" (linhas 110-113).
- Inserir o check da flag **antes** de buscar profissionais (após o check de `fila_atribuicao_ativa`).

**b) `supabase/functions/atribuir-proxima-tarefa/index.ts`**
- Inserir o check logo após criar o supabase client.
- Quando manual ativo, retornar `{ atribuido: false, motivo: 'manual_ativo' }` sem tocar em `servicos`.

**c) `supabase/functions/cron-reagendamento-automatico/index.ts` — Parte 1 (órfãos)**
- O fluxo de detectar órfãos (status `agendada` sem `profissional_id` há >2h) deve continuar rodando, mas a **ação de auto-atribuir** ao técnico mais próximo (linhas 112-122) deve ser pulada quando manual ativo.
- Em vez de atribuir, apenas logar como pendente para que o coordenador atribua via painel. O envio de link de reagendamento (Parte 2) continua funcionando normalmente.

**d) `supabase/functions/criar-instalacao-pos-pagamento/index.ts`**
- Antes de invocar `cron-atribuir-tarefas` (linha 569), checar a flag. Se manual ativo, pular a invocação — a tarefa nasce sem `profissional_id` e aparece no painel de Atribuição Manual.

### 3) Validação após deploy

1. Confirmar `atribuicao_manual_rotas = true` no banco.
2. Criar serviço de teste sem profissional → aguardar 5 min → conferir que `cron-atribuir-tarefas` logou "Atribuição MANUAL ativa" e o serviço continua sem `profissional_id`.
3. Reagendar via link público uma vistoria → confirmar que volta a `agendada` mas **não** ganha `profissional_id` automaticamente.
4. Concluir uma tarefa em campo → `atribuir-proxima-tarefa` deve retornar `manual_ativo` e **não** entregar nova tarefa automaticamente.
5. Aprovar pagamento de um contrato novo → instalação criada deve aparecer no painel manual sem profissional.
6. Desligar o switch → próximos ciclos voltam a atribuir normalmente.

### Arquivos tocados
- `supabase/functions/cron-atribuir-tarefas/index.ts`
- `supabase/functions/atribuir-proxima-tarefa/index.ts`
- `supabase/functions/cron-reagendamento-automatico/index.ts`
- `supabase/functions/criar-instalacao-pos-pagamento/index.ts`

Sem mudança de schema. Sem nova dependência. Sem mudança de frontend. `processar-encaixes-automaticos` permanece como está (já correto, vira o padrão de referência).

