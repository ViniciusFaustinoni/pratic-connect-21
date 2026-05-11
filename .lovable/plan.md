# Bug

Quando o cenário de adesão é **isenta** (`isenta_base` ou `isenta_rota`), o sistema continua descontando o **repasse volante (R$50)** do vendedor — gerando saldo negativo indevido. Não havendo valor de adesão para o vendedor receber, também não deve haver dedução de repasse.

## Causa raiz

`public.calcular_comissao_contrato(p_contrato_id)` (função SQL):

```sql
IF v_tipo_atendimento = 'volante' THEN
  v_repasse := COALESCE(fn_parametro_comissao('repasse_volante'), 50);
  v_deducoes := v_deducoes || jsonb_build_object('tipo','repasse_volante','valor',v_repasse);
  v_total_deducoes := v_total_deducoes + v_repasse;
END IF;
```

A condição não considera `contratos.cenario_adesao`. Toda venda volante leva o desconto, mesmo isenta.

# Correção

## Migration: ajustar `calcular_comissao_contrato`

Adicionar guarda para pular a dedução `repasse_volante` quando:

- `v_contrato.cenario_adesao IN ('isenta_base','isenta_rota')`, **ou**
- `COALESCE(v_contrato.valor_adesao, 0) = 0` (segurança extra: sem adesão a descontar).

Aplicar a mesma guarda no segundo bloco (`INSERT INTO comissoes_deducoes ...`) para não gravar a linha de dedução.

Pseudo-código:

```sql
v_isenta_adesao := v_contrato.cenario_adesao IN ('isenta_base','isenta_rota')
                   OR COALESCE(v_contrato.valor_adesao, 0) = 0;

IF v_tipo_atendimento = 'volante' AND NOT v_isenta_adesao THEN
  -- aplica repasse_volante
END IF;
```

## Detalhes

- A função é `SECURITY DEFINER` — manter `SET search_path = public`.
- Comissões já calculadas antes deste fix permanecem como estão (não há reprocessamento automático). Se o usuário quiser limpar deduções históricas, pedimos confirmação separada.
- Não altera `fn_gerar_comissao_plano_nivel` (recorrente) — escopo restrito ao repasse de adesão.

# Arquivos afetados

- Migration nova: `CREATE OR REPLACE FUNCTION public.calcular_comissao_contrato(...)` com a guarda de cenário isento.
