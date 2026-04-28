# Plano: Sync SGA tolerante à ausência de código de plano

## Problema confirmado

Na `supabase/functions/sga-hinova-sync/index.ts`, linhas **1494–1526**, o bloco de resolução de plano **aborta a sync com `return`** em três casos:

1. `plano_id` não encontrado em `planos`
2. `planoRow.codigo_sga_plano` ausente
3. `codigo_sga_plano` inválido (não numérico)

Como esse bloco roda **depois** de `/associado/cadastrar` (linha 1118) e **antes** de `/veiculo/cadastrar` (linha 1605), o associado é criado no Hinova mas o veículo não — exatamente o cenário relatado (~60% das falhas: planos "5%" sem `codigo_sga_plano`).

O payload do veículo (linhas 1579–1602) já é construído com **spread condicional**:
```ts
...(codigoPlanoSga !== null && { codigo_plano: codigoPlanoSga }),
...(valorMensalidadePayload !== null && { valor_mensalidade: ... }),
...(valorAdesaoPayload !== null && { valor_adesao: ... }),
...(produtosVinculados.length > 0 && { produtos_vinculados: ... }),
```
Ou seja, **a infraestrutura para enviar veículo sem plano já existe** — só o `return` precoce está bloqueando.

## Regra de negócio (conforme solicitado)

- Resolução é feita **exclusivamente pelo `codigo_sga_plano`** (numérico). **Nunca** por nome/sufixo/prefixo.
- **Com código válido** → envia associado + veículo + plano + benefícios + coberturas (comportamento atual).
- **Sem código (ausente, vazio, inválido ou plano não encontrado)** → envia somente associado + veículo. Hinova usa o plano default da conta. Ajustes finos ficam para o operador no SGA.

## Mudanças

### Arquivo único: `supabase/functions/sga-hinova-sync/index.ts` (linhas 1489–1577)

Substituir os três blocos `return` por **warnings + continue**, mantendo `codigoPlanoSga = null`:

```ts
let codigoPlanoSga: number | null = null;
let valorMensalidadePayload: number | null = null;
let valorAdesaoPayload: number | null = null;
const produtosVinculados: { codigo_produto: number; valor: number }[] = [];

if (contrato?.plano_id) {
  const { data: planoRow } = await supabase
    .from('planos')
    .select('id, nome, codigo_sga_plano, valor_adesao')
    .eq('id', contrato.plano_id)
    .maybeSingle();

  // Resolução estritamente pelo codigo_sga_plano. Sem código → segue sem plano.
  const parsedCodigoPlano = planoRow?.codigo_sga_plano
    ? Number.parseInt(planoRow.codigo_sga_plano, 10)
    : NaN;

  if (Number.isFinite(parsedCodigoPlano) && parsedCodigoPlano > 0) {
    codigoPlanoSga = parsedCodigoPlano;

    valorMensalidadePayload = contrato.valor_mensal != null ? Number(contrato.valor_mensal) : null;
    valorAdesaoPayload = contrato.valor_adesao != null
      ? Number(contrato.valor_adesao)
      : (planoRow?.valor_adesao != null ? Number(planoRow.valor_adesao) : null);

    // Benefícios e coberturas (mantém lógica atual, linhas 1535–1572)
    // ...
    console.log(`[SGA Sync] Plano resolvido: codigo_sga=${codigoPlanoSga}, ...`);
  } else {
    const motivo = !planoRow
      ? 'plano_nao_encontrado_no_banco'
      : (!planoRow.codigo_sga_plano ? 'plano_sem_codigo_sga' : 'codigo_sga_invalido');
    console.warn(`[SGA Sync] ${motivo} (plano_id=${contrato.plano_id}). Enviando veículo sem codigo_plano — Hinova usará default da conta.`);
    await logSync(_vid, _aid, 'resolver_plano', 'warning',
      { plano_id: contrato.plano_id, motivo }, null,
      'Veículo será enviado sem codigo_plano. Ajuste manual no SGA pode ser necessário.');
  }
} else {
  console.warn('[SGA Sync] Contrato sem plano_id — cadastro será enviado sem codigo_plano.');
}
```

**O que foi removido:**
- `return` quando plano não existe
- `return` quando `codigo_sga_plano` ausente
- `return` quando `codigo_sga_plano` inválido
- `update veiculos.status_sga = 'erro_sincronizacao'` nesses casos
- `upsertSyncQueue` com motivos `plano_nao_encontrado` / `plano_sem_codigo_sga` / `plano_codigo_sga_invalido`

**O que foi mantido:**
- Resolução estritamente pelo `codigo_sga_plano` (nunca por nome).
- Envio de plano + valores + produtos_vinculados quando o código existe.
- Spread condicional já existente nas linhas 1598–1601 — sem `codigo_plano`, Hinova usa default.
- Log estruturado em `sga_sync_logs` com `status='warning'` para rastreabilidade dos veículos que entraram "incompletos".

## Backfill

Após o deploy, rodar reprocessamento dos 33 veículos identificados anteriormente que ficaram com `status_sga='erro_sincronizacao'` por causa de `plano_sem_codigo_sga` / `plano_nao_encontrado` / `plano_codigo_sga_invalido`. O reprocessamento usa o mesmo edge `sga-hinova-sync` — agora ele vai concluir o cadastro do veículo no Hinova mesmo sem código de plano.

Filtro do backfill (consulta em `sga_sync_queue`):
```sql
status_atual IN ('plano_sem_codigo_sga','plano_nao_encontrado','plano_codigo_sga_invalido')
```

## Fora de escopo

- **Não** vou cadastrar `codigo_sga_plano` para os planos "5%" — isso é decisão do usuário/operação no SGA.
- **Não** vou alterar a lógica de associado/cadastrar nem a resolução de FIPE/ano.
- **Não** mexo em outras causas (token expirado, conflito de placa, FIPE incompatível) — são tickets separados já mapeados.

## Resultado esperado

- Causa #1 (~60% das falhas) eliminada: associado **e** veículo passam a ser sincronizados sempre que os dados básicos forem válidos.
- Veículos sem `codigo_plano` chegam ao SGA prontos para ajuste manual de plano pelo operador.
- Logs `warning` permitem auditoria de quais veículos precisam de revisão manual posterior.
