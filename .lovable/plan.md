

## Painel de falhas por falta de linha digitável (SGA)

### Diagnóstico

O fallback no backend **já está implementado** em `supabase/functions/executar-regua-cobranca/index.ts` (linhas 491–496):

- Quando o template exige `linha_digitavel` (mapa em `TEMPLATE_PARAMS_MAP`) e a cobrança SGA não tem o código,
- O envio é **bloqueado** (não vai mensagem incompleta para a Meta),
- Um evento é gravado em `cobranca_eventos` com `dados.status = 'falhou'`, `dados.falta_sga = true` e `dados.erro = 'Sem linha digitável SGA disponível — sincronize o financeiro do veículo'`,
- O contador `whatsapp_falhas` é incrementado e exibido no card "Execução automática".

**O que falta:** o usuário só vê um número agregado ("Falhas: 12"). Não vê **quais associados/veículos** falharam nem **o que precisa sincronizar**. Hoje precisa abrir o banco para descobrir.

### Mudanças

**A. Novo card "Cobranças bloqueadas — falta linha digitável" em `src/pages/cobranca/ReguaCobranca.tsx`**

Inserir entre o card "Execução automática" (linha 493) e "Pré-visualização de mensagens" (linha 495). Lista as últimas 30 falhas por `falta_sga` dos últimos 7 dias.

Query (React Query, key `regua-falhas-sga`):
```ts
supabase.from('cobranca_eventos')
  .select('id, created_at, descricao, associado_id, dados, associados!inner(nome, cpf)')
  .eq('tipo', 'whatsapp')
  .eq('dados->>falta_sga', 'true')
  .gte('created_at', seteDiasAtras)
  .order('created_at', { ascending: false })
  .limit(30)
```

Cada linha mostra:
- **Associado** (nome + CPF, link para `/cadastro/associados/:id`)
- **Etapa** (`dados.dia_regua` formatado: `D-6`, `D+0`…)
- **Template** que tentou disparar (`dados.template`)
- **Quando** (`created_at` formatado pt-BR)
- Botão **"Sincronizar SGA"** que chama `supabase.functions.invoke('sga-sync-financeiro-veiculo', { body: { associado_id, veiculo_id: dados.veiculo_id } })`. Em caso de sucesso, toast verde + `queryClient.invalidateQueries(['regua-falhas-sga'])`. Em caso de erro, toast vermelho com a mensagem.

Cabeçalho do card com:
- Ícone `AlertTriangle` âmbar
- Total de falhas no período
- Botão **"Sincronizar todas"** (loop com `Promise.allSettled`, throttled de 1 em 1, mostra progresso) — só aparece quando há ≥ 2 falhas.

Quando lista vazia: estado vazio amigável ("Nenhuma cobrança bloqueada nos últimos 7 dias 🎉").

**B. Garantir gravação de `veiculo_id` no evento de falha**

A edge function já passa `veiculo_id` no contexto, mas hoje grava só `linha_digitavel` e `boleto_url` em `dados` (linhas 535-536). Adicionar `veiculo_id` ao payload (linha 535-536) para o botão "Sincronizar SGA" funcionar sem query extra:

```ts
dados: {
  ...
  veiculo_id,        // ← adicionar
  fonte,
  linha_digitavel: linha_digitavel || null,
  ...
}
```

Mudança mínima, 1 linha. Eventos antigos (sem `veiculo_id`) continuam funcionando — o botão faz fallback buscando o veículo principal do associado.

**C. Banner no topo da página**

Quando `falhas_sga > 0` no período, banner amarelo no topo (acima do card "Templates não aprovados" já existente):

> ⚠️ **N cobranças foram bloqueadas hoje por falta de linha digitável do SGA.** Veja a lista abaixo e sincronize os veículos afetados.

Clica → scroll suave até o card.

### Arquivos editados

- `src/pages/cobranca/ReguaCobranca.tsx` — novo card + query + banner + botão sincronizar.
- `supabase/functions/executar-regua-cobranca/index.ts` — adicionar `veiculo_id` ao payload de `cobranca_eventos.dados`.

### O que NÃO muda

- O fallback de bloqueio do envio (já funciona).
- O contador de falhas no card "Execução automática" (já funciona).
- A edge function `sga-sync-financeiro-veiculo` (já existe e é chamada como está).
- Schema, migrations, RLS — nenhuma alteração.

### Validação (após implementação)

1. Login `admin@teste.com / 123456789` → `/cobranca/regua`.
2. Conferir: se houver falhas SGA dos últimos 7 dias, o card aparece listando associados + botão "Sincronizar SGA".
3. Clicar em uma linha → confirmar que o sync roda e a falha some da lista após próxima execução da régua.
4. Screenshot do card populado.

### Riscos

- **Botão "Sincronizar todas"** pode disparar muitas chamadas SGA em sequência. Mitigação: throttle de 1 chamada por segundo, hard cap de 30 (mesmo limite da query).
- Eventos antigos sem `veiculo_id` no payload: fallback busca veículo principal via `associados.veiculo_principal_id` (ou primeiro veículo ativo).

