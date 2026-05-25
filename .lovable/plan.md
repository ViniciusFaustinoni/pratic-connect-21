## Diagnóstico (código + banco, sem palpite)

### #2 — "Could not choose the best candidate function" ao realocar

Existem **duas funções `public.realocar_servico` ativas no banco** (`pg_proc`):

```text
A) (_servico_id uuid, _motivo text, _destino text, _categoria text,
    _nova_data date, _novo_periodo text,
    _profissional_id uuid, _rota_id uuid, _oficina_id uuid)        ← antiga

B) (_servico_id uuid, _destino text, _motivo text, _categoria text,
    _profissional_id uuid, _rota_id uuid, _oficina_id uuid,
    _nova_data date, _novo_periodo text)                           ← nova
```

Mesma aridade (9 params), mesmos nomes — só a ordem mudou. Quando o front chama via `supabase.rpc('realocar_servico', { _servico_id, _destino, _motivo, ... })` (named params), o Postgres tem 2 candidatas válidas e devolve `42883`.

A nova (B) entrou na migration `supabase/migrations/20260525142831_8fb86ad4-6abe-42e5-85f3-1d9e229b762a.sql` (saneamento LSA7A65 de 25/05) com `CREATE OR REPLACE`, mas como a **assinatura mudou de ordem**, o `OR REPLACE` criou uma segunda função em vez de substituir a anterior. A antiga (A) ficou órfã.

Call-sites do front (confirmado por `rg`):
- `src/hooks/useRealocarInstalacao.ts:85` → `{ _servico_id, _motivo, _destino, _categoria, _nova_data, _novo_periodo, _profissional_id, _rota_id, _oficina_id }`
- `src/components/servicos-campo/RealocarServicoSimplesDialog.tsx:55` → `{ _servico_id, _destino, _motivo, _nova_data, _novo_periodo, _profissional_id }`

Wrappers DB que dependem da função (`liberar_servico_para_reatribuicao`, `reatribuir_servico_admin`): chamam com named params também, então hoje **também estão quebrados** por baixo (mesma ambiguidade). DROP da (A) restaura ambos.

A assinatura (B) cobre 100% dos casos atuais — todos os parâmetros nomeados nos call-sites existem nela.

### #1 — Duplicação na aba Serviços (KVV7538)

`SELECT` confirmou 2 linhas em `servicos` para o mesmo veículo (`MAURO ROBERTO SILVA DE LIMA`, KVV7538):

| id | tipo | status | origem | instalacao_origem_id | vistoria_origem_id |
|---|---|---|---|---|---|
| f140ae0d… | `vistoria_entrada` | `cancelada` | NULL | NULL | `d03f6b41…` |
| 13e22d3a… | `instalacao` | `agendada` | `instalacao` | `c155da26…` | NULL |

São **o mesmo evento físico** (memória core: `vistoria_entrada ≡ instalacao`). O 1º nasceu da autovistoria do cliente, o 2º do agendamento da instalação técnica.

O dedup em `src/hooks/useServicosCampoUnificado.ts:182-198` (`servicosDeduplicados`) agrupa **por origem materializada primeiro**:

```text
chave = vist:d03f6b41…   (vistoria_entrada)
chave = inst:c155da26…   (instalacao)
```

Como cada um tem sua própria origem (id diferente), caem em chaves distintas → 2 cards na UI. O fallback lógico `lg:associado|veiculo|tipoCanonico` (que colapsa `vistoria_entrada`→`instalacao`) **só dispara quando ambas origens são NULL**, então não resgata esse caso.

Resultado: o card cancelado fica visível ao lado do agendado, polui a Atribuição Manual / aba Serviços e foi o que o usuário viu no print.

---

## Plano de fix

### Parte A — Banco: remover a assinatura antiga (resolve #2 e wrappers)

Uma migration única que:

1. `DROP FUNCTION public.realocar_servico(uuid, text, text, text, date, text, uuid, uuid, uuid);` — derruba a assinatura (A).
2. Verifica via `pg_proc` que sobrou exatamente 1 função com nome `realocar_servico` e que sua assinatura bate com (B). Se não bater, `RAISE EXCEPTION` aborta a migration.
3. Testa idempotência: roda `SELECT public.realocar_servico(_servico_id := '00000000-0000-0000-0000-000000000000', _destino := 'fila', _motivo := 'noop', _categoria := 'teste')` em bloco `BEGIN…EXCEPTION WHEN OTHERS THEN…END` apenas para validar que o despacho não dá mais 42883; qualquer outro erro (servico inexistente etc.) é esperado e ignorado nesse smoke.

Nenhuma mudança na lógica de `realocar_servico` (B) — ela já é a versão correta usada pelo saneamento LSA7A65.

### Parte B — Front: corrigir o dedup para colapsar instalação ↔ vistoria_entrada

Único arquivo: `src/hooks/useServicosCampoUnificado.ts`, função `servicosDeduplicados` (linhas 182-198).

Trocar a regra de chave para:

```text
Para tipo ∈ {instalacao, vistoria_entrada}:
  chave = `evt:${associado_id}|${veiculo_id}|instalacao`
  (ignora instalacao_origem_id / vistoria_origem_id para fins de agrupamento)

Para os outros tipos (revistoria, vistoria_saida, vistoria_sinistro,
vistoria_periodica, vistoria_manutencao, vistoria_retirada):
  manter a chave atual baseada em origem materializada → fallback lógico.
```

Justificativa: a memória core `vistoria_entrada ≡ instalacao` é estrita — qualquer combinação dos dois tipos para o mesmo veículo+associado é a MESMA visita física, independente de quais origens foram materializadas. Esse caso (KVV7538) prova que confiar na origem isolada quebra. Para os outros tipos de vistoria, origem materializada continua sendo o sinal mais confiável (uma manutenção pode coexistir com uma vistoria_entrada do mesmo veículo).

Comportamento esperado pós-fix na aba Serviços do KVV7538:
- Um único card (a `instalacao` agendada, que tem prioridade mais alta no `STATUS_PRIORITY`)
- A `vistoria_entrada` cancelada vai para `tentativas_anteriores` do mesmo card (visível como badge "1x reagendado" ou similar)

Nenhuma mudança em `useServicos`, `ServicosTable`, nem nos contadores de métricas — a saída do hook continua expondo o mesmo shape.

### Não entra neste deploy

- Saneamento histórico de outros casos com duplicação parecida (se existirem) — primeiro confirma-se o fix com KVV7538, depois roda uma query de dimensionamento em deploy separado.
- Mudança na lógica de criação de `servicos` (ex.: cancelar `vistoria_entrada` automaticamente quando a `instalacao` é agendada). Isso é assunto canônico de `mem://logic/operations/servicos-um-canonico-por-origem` e o dedup de UI resolve o sintoma; mexer na regra de criação amplia escopo.

---

## Verificação pós-deploy

1. **#2 (RPC):** Abrir o `RealocarServicoSimplesDialog` no KVV7538 (instalação agendada), preencher motivo, clicar "Reagendar e enviar para fila" → toast verde "Serviço realocado" e nenhum erro 42883 no console/network.
2. **#1 (dedup):** Recarregar `/monitoramento/vistorias-instalacoes-mon`, filtrar `KVV7538` → "Mostrando **1** serviço(s)" e apenas a `instalacao` visível (badge ou nota indicando 1 tentativa anterior).
3. **Wrappers DB:** Chamar `SELECT public.liberar_servico_para_reatribuicao(...)` em qualquer serviço de teste do painel — não deve mais dar 42883.

Reporta o resultado dos 3 pontos antes de eu propor saneamento histórico ou qualquer extensão.