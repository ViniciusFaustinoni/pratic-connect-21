

## Deduplicar agendamentos: substituir/encerrar antigos em vez de empilhar novos

### Diagnóstico

Confirmei na base e no código múltiplas fontes de duplicação. O padrão geral é o mesmo em todos os fluxos: **insere linha nova sem fechar/atualizar a antiga**. Casos encontrados:

**1. `reagendar-vistoria-publica` (edge function)** — quando o associado reagenda pelo link público:
- ✅ Cria novo `servicos`.
- ✅ Marca o `servicos` antigo como `reagendada`.
- ❌ **NÃO toca em `agendamentos_base`** — o card antigo na aba "Atribuição" continua aparecendo com `status='agendado'`.
- ❌ Se associado reagenda 2×+, o filtro `servico.status === 'reagendada'` (linha 99) já bloqueia, mas só na 2ª chamada. Se duas chamadas chegarem em paralelo (clique duplo), insere duas vezes — sem `unique` constraint.

**2. `cron-reagendamento-automatico`** — marca serviço como `nao_compareceu` mas:
- ❌ Não fecha o `agendamentos_base` correspondente (cotação/instalação/vistoria origem).
- O `enviar-link-reagendamento` é disparado depois → quando associado reagenda, vira o caso 1.

**3. `aprovar-proposta` + `criar-instalacao-pos-pagamento` (edge functions)** — ambas inserem em `instalacoes` sem checagem prévia. Encontrei na base **um par de duplicatas reais** (cotação `0704154f-…`, dois `instalacoes` criados com 290 ms de diferença, ambos `status='agendada'`, gerando dois `servicos` ativos). Causa: ambas funções podem rodar para o mesmo evento (ou re-aprovação manual).

**4. `useRealocarInstalacao.realocarParaBase`** — insere `agendamentos_base` para a `instalacao_id` sem cancelar nenhum `agendamentos_base` ativo anterior da mesma instalação.

**5. `useAlterarEnderecoTipo` (caminho `mover_para_base`)** — único lugar que **faz certo**: fecha o agendamento_base antigo (`status='cancelado'`, linha 269) e insere o novo. Vai ser nosso modelo.

### Princípio de correção

**Uma cotação/instalação/vistoria/sinistro só pode ter UM agendamento ativo por vez.** Antes de criar um novo `agendamentos_base` ou `instalacoes` para a mesma origem, fechar (`status='cancelado'` ou `'reagendado'`) os ativos anteriores. Quando uma origem (vistoria/instalação/serviço) muda para `nao_compareceu`/`cancelada`/`reagendada`, propagar o fechamento para `agendamentos_base`.

### Mudanças

**A. `supabase/functions/reagendar-vistoria-publica/index.ts`**

Após linha 178 (depois de marcar `servicos` antigo como `reagendada`), adicionar:

```ts
// Encerrar agendamentos_base antigos vinculados à mesma origem (cotação/instalação/vistoria)
const filtros: Array<{ col: string; val: string }> = [];
if (servico.cotacao_id) filtros.push({ col: 'cotacao_id', val: servico.cotacao_id });
if (servico.instalacao_origem_id) filtros.push({ col: 'instalacao_id', val: servico.instalacao_origem_id });
if (servico.vistoria_origem_id) filtros.push({ col: 'vistoria_id', val: servico.vistoria_origem_id });

for (const f of filtros) {
  await supabase
    .from('agendamentos_base')
    .update({ status: 'reagendado', updated_at: new Date().toISOString() })
    .eq(f.col, f.val)
    .in('status', ['agendado','pendente','confirmado']);
}
```

E adicionar **guard de idempotência** logo no início (após validar token), checando se já existe `servicos` em `status='agendada'` com `data_agendada=nova_data` para a mesma origem nos últimos 60 s — se sim, retornar sucesso reusando o `id`.

**B. `supabase/functions/cron-reagendamento-automatico/index.ts`**

No bloco que marca `nao_compareceu` (linhas 184-194 e 384-396), adicionar logo depois:

```ts
// Fechar agendamentos_base vinculados (sem isso, card fantasma na atribuição)
if (refs?.instalacao_origem_id) {
  await supabase.from('agendamentos_base')
    .update({ status: 'nao_compareceu', updated_at: new Date().toISOString() })
    .eq('instalacao_id', refs.instalacao_origem_id)
    .in('status', ['agendado','pendente','confirmado']);
}
if (refs?.vistoria_origem_id) {
  await supabase.from('agendamentos_base')
    .update({ status: 'nao_compareceu', updated_at: new Date().toISOString() })
    .eq('vistoria_id', refs.vistoria_origem_id)
    .in('status', ['agendado','pendente','confirmado']);
}
```

**C. `supabase/functions/aprovar-proposta/index.ts` (linha 323) e `criar-instalacao-pos-pagamento/index.ts` (linha 423)**

Antes do `insert` de `instalacoes`, adicionar guard de idempotência:

```ts
const { data: jaExiste } = await supabase
  .from('instalacoes')
  .select('id')
  .eq('cotacao_id', contrato.cotacao_id)
  .eq('veiculo_id', veiculoId)
  .in('status', ['agendada','em_andamento','em_analise'])
  .maybeSingle();

if (jaExiste) {
  console.log('[…] Instalação já existe para essa cotação/veículo — pulando criação:', jaExiste.id);
  novaInstalacaoId = jaExiste.id;
} else {
  // … insert atual
}
```

**D. `src/hooks/useRealocarInstalacao.ts` — `realocarParaBase`**

Antes do `insert` em `agendamentos_base` (linha 168), cancelar quaisquer agendamentos_base ativos da mesma instalação:

```ts
await supabase.from('agendamentos_base')
  .update({ status: 'cancelado', updated_at: new Date().toISOString(),
            observacoes: 'Realocada para nova base' })
  .eq('instalacao_id', params.instalacaoId)
  .in('status', ['agendado','pendente','confirmado']);
```

**E. Trigger SQL — rede de segurança (migration nova)**

Garantir consistência mesmo que algum fluxo futuro esqueça:

```sql
-- Quando servicos vai para status terminal/reagendamento, fechar agendamentos_base ligados
CREATE OR REPLACE FUNCTION public.sync_agendamento_base_on_servico_terminal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_novo_status text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('cancelada','reagendada','nao_compareceu') THEN
    v_novo_status := CASE NEW.status
                       WHEN 'cancelada' THEN 'cancelado'
                       WHEN 'reagendada' THEN 'reagendado'
                       WHEN 'nao_compareceu' THEN 'nao_compareceu'
                     END;

    UPDATE agendamentos_base SET status = v_novo_status, updated_at = now()
     WHERE status IN ('agendado','pendente','confirmado')
       AND ( (NEW.cotacao_id IS NOT NULL AND cotacao_id = NEW.cotacao_id)
          OR (NEW.instalacao_origem_id IS NOT NULL AND instalacao_id = NEW.instalacao_origem_id)
          OR (NEW.vistoria_origem_id IS NOT NULL AND vistoria_id = NEW.vistoria_origem_id) );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sync_agendamento_base_on_servico_terminal
AFTER UPDATE OF status ON servicos
FOR EACH ROW EXECUTE FUNCTION sync_agendamento_base_on_servico_terminal();
```

**F. Backfill (na mesma migration)**

Limpar duplicatas existentes:

```sql
-- Fechar agendamentos_base órfãos cuja origem já não está mais ativa
UPDATE agendamentos_base ab SET status='cancelado', updated_at=now()
 WHERE ab.status IN ('agendado','pendente','confirmado')
   AND ( EXISTS (SELECT 1 FROM servicos s
                  WHERE s.cotacao_id = ab.cotacao_id
                    AND s.status IN ('cancelada','reagendada','nao_compareceu','concluida')
                    AND NOT EXISTS (SELECT 1 FROM servicos s2
                                     WHERE s2.cotacao_id = ab.cotacao_id
                                       AND s2.status IN ('agendada','em_rota','em_andamento','pendente'))) );

-- Em (cotacao_id, veiculo_id) com múltiplas instalacoes ativas, manter só a mais recente
WITH dup AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY cotacao_id, veiculo_id ORDER BY created_at DESC) rn
    FROM instalacoes
   WHERE status IN ('agendada','em_andamento')
)
UPDATE instalacoes SET status='cancelada', updated_at=now()
 WHERE id IN (SELECT id FROM dup WHERE rn > 1);

-- Idem servicos órfãos das instalacoes canceladas acima
UPDATE servicos SET status='cancelada', updated_at=now()
 WHERE instalacao_origem_id IN (
   SELECT id FROM instalacoes WHERE status='cancelada'
     AND updated_at >= now() - interval '1 minute'
 ) AND status IN ('agendada','pendente');
```

**G. Memória nova** — `mem://logic/operations/dedupe-agendamentos-rule.md`:
> Toda criação de `agendamentos_base`/`instalacoes`/`servicos` para uma mesma origem (cotação, instalação, vistoria, sinistro) deve **fechar primeiro** (status `cancelado`/`reagendado`) qualquer linha ativa anterior. Trigger `trg_sync_agendamento_base_on_servico_terminal` é a rede de segurança. Nunca empilhar registros para a mesma origem.

### Arquivos editados

- `supabase/functions/reagendar-vistoria-publica/index.ts` — fechar agendamentos_base antigos + guard de idempotência.
- `supabase/functions/cron-reagendamento-automatico/index.ts` — propagar `nao_compareceu` para agendamentos_base.
- `supabase/functions/aprovar-proposta/index.ts` — guard de idempotência antes do insert de `instalacoes`.
- `supabase/functions/criar-instalacao-pos-pagamento/index.ts` — mesmo guard.
- `src/hooks/useRealocarInstalacao.ts` — cancelar agendamentos_base ativos antes de inserir novo.
- Migration nova — trigger `trg_sync_agendamento_base_on_servico_terminal` + backfill de duplicatas.
- `mem://logic/operations/dedupe-agendamentos-rule.md` (nova).

### O que NÃO muda

- `useAlterarEnderecoTipo` já segue o padrão correto.
- Listagens (`useAtribuicaoManual`, `CalendarioDiaModal`) já filtram por status — depois da correção, naturalmente passam a mostrar só o card vivo.
- Realtime/invalidações já cobertas por hooks existentes.

### Riscos

- Trigger pode disparar em loop se algum hook reagir a mudança de `agendamentos_base` re-atualizando `servicos`. Não há esse caminho hoje, mas vou validar buscando triggers em `agendamentos_base` antes de aplicar.
- Backfill toca registros históricos — efeito desejado para sumir os "vários cards iguais" já existentes; lista de IDs alterados sai no log da migration.
- Guard de idempotência por `(cotacao_id, veiculo_id)` em `instalacoes`: se houver caso legítimo de 2 instalações para mesma cotação/veículo (ex.: substituição de equipamento), o guard bloqueia. Vou checar se a substituição cria via outro caminho (sem `cotacao_id`) — se conflitar, ajusto o guard para incluir janela de tempo (últimos N minutos) em vez de status.

