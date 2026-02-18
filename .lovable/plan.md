
# Corrigir Card de Valores do Sinistro

## Problema

O card "Valores" exibe tracos (--) em todos os campos porque os dados estao sendo lidos de campos errados ou nulos na tabela `sinistros`:

| Campo no Card | Campo usado no codigo | Valor no banco | Correcao |
|---|---|---|---|
| Valor FIPE | `sinistro.valor_fipe` | NULL | Usar `sinistro.veiculo.valor_fipe` como fallback (veiculos tem R$ 70.008,00) |
| Participacao | `sinistro.valor_participacao` | 0.00 | Usar `sinistro.valor_cota_participacao` que tem R$ 4.200,48 |
| Valor Indenizacao | `sinistro.valor_indenizacao` | NULL | Manter (preenchido apos finalizacao, OK estar vazio agora) |
| Valor Pago | `sinistro.valor_pago` | NULL | Manter (preenchido apos pagamento da oficina, OK estar vazio agora) |

## Solucao

### 1. Corrigir exibicao no card de Valores (SinistroDetalhe.tsx, linhas 866-892)

**Valor FIPE**: Usar fallback para o valor do veiculo:
```text
sinistro.valor_fipe || sinistro.veiculo?.valor_fipe
```

**Participacao**: Usar o campo correto `valor_cota_participacao`:
```text
sinistro.valor_cota_participacao || sinistro.valor_participacao
```

### 2. Corrigir o sinistro no banco (migration SQL)

Preencher `valor_fipe` no sinistro com o valor do veiculo para que o campo fique persistido:

```text
UPDATE sinistros s
SET valor_fipe = v.valor_fipe
FROM veiculos v
WHERE s.veiculo_id = v.id
AND s.protocolo = 'SIN-20260217-0008'
AND s.valor_fipe IS NULL;
```

Tambem copiar `valor_cota_participacao` para `valor_participacao` para manter consistencia:

```text
UPDATE sinistros
SET valor_participacao = valor_cota_participacao
WHERE protocolo = 'SIN-20260217-0008'
AND (valor_participacao IS NULL OR valor_participacao = 0)
AND valor_cota_participacao > 0;
```

## Arquivo alterado

1. **`src/pages/eventos/SinistroDetalhe.tsx`** -- fallback no card de Valores (linhas 870 e 876)
2. **Migration SQL** -- preencher `valor_fipe` e `valor_participacao` do sinistro existente
