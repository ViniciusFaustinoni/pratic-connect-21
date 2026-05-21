# Diagnóstico — COT-20260521-123609790-701

## Sintoma
No link público, ao clicar **"Continuar com este plano"**, o toast retorna:
> `Erro ao selecionar plano: record "new" has no field "valor_total"`

A cotação fica travada em `status='rascunho'` sem nunca gravar `plano_escolhido_id`.

## Causa raiz
Existe no banco o trigger `BEFORE UPDATE` em `public.cotacoes`:

```
trg_cotacoes_renovar_reserva → fn_cotacoes_renovar_reserva()
```

A função foi escrita para um schema antigo/diferente e referencia **4 campos que não existem** na tabela `cotacoes` atual:

| Referência no trigger | Existe em `cotacoes`? | Coluna real |
|---|---|---|
| `NEW.valor_total` | ❌ | `valor_total_mensal` |
| `NEW.observacoes` | ❌ | — (não existe) |
| `NEW.cotacao_publica_token` | ❌ | `token_publico` |
| `NEW.placa_reservada_ate` | ✅ | — |
| `NEW.plano_id` | ✅ | — |

Como é `BEFORE UPDATE FOR EACH ROW`, **qualquer** UPDATE em `cotacoes` dispara o erro `42703: record "new" has no field "valor_total"` — não só seleção de plano. Isso afeta link público inteiro (escolher plano, gravar documentos, agendamento, etc.) — só não estourou antes porque o caminho específico que ataca o UPDATE depende do estado da cotação.

## Por que é seguro remover

1. **Nenhum código TS/SQL/edge function referencia** `placa_reservada_ate`, `fn_cotacoes_renovar_reserva`, `prazo_renovacao_movimentacao_horas` ou `prazo_teto_placa_presa_horas` (`rg` no projeto inteiro retornou 0 hits).
2. O campo `cotacoes.placa_reservada_ate` está sempre `NULL` (verificado em produção) — feature de "reserva de placa" nunca foi ativada nem lida.
3. A função `fn_cotacoes_renovar_reserva` está órfã: chamada só por este único trigger.

## Plano (1 migration)

**Migration única — `drop_trigger_cotacoes_renovar_reserva_quebrado`:**

```sql
DROP TRIGGER IF EXISTS trg_cotacoes_renovar_reserva ON public.cotacoes;
DROP FUNCTION IF EXISTS public.fn_cotacoes_renovar_reserva();
```

Sem alterações em código TS, edges ou UI — o erro é 100% de banco. Após o drop, o UPDATE do link público (`plano_escolhido_id` + `valor_total_mensal`) passa.

## Validação pós-deploy

1. Repetir o clique em "Continuar com este plano" na cotação `COT-20260521-123609790-701` → toast some, cotação avança para próxima etapa do link público.
2. Conferir que `cotacoes` aceita UPDATE simples (`UPDATE cotacoes SET updated_at=now() WHERE id=...`) sem erro.
3. `rg "placa_reservada_ate|renovar_reserva"` continua zero — confirmação que nada quebra junto.

## Fora do escopo

- Reescrever a feature "reserva de placa" (não existe consumidor — se um dia for necessária, vira projeto próprio com colunas reais).
- Mexer em `calc_orcamento_item_total` (também usa `NEW.valor_total`, mas em outra tabela onde a coluna existe; está OK).
- Tocar no fluxo de seleção de plano em si — está correto, só é vítima do trigger.
