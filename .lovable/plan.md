## Diagnóstico (auditado)

- A linha **"Câmbio"** já existe no termo (vide screenshot do OPO9H00 mostrando `Câmbio: —`).
- Hoje o valor é produzido por **`inferirCambio(modelo)`** em `supabase/functions/_shared/termo-afiliacao-utils.ts:456`, aplicando regex sobre o nome do modelo gravado no contrato.
- Para o veículo **OPO9H00** o modelo no banco é `"cobalt Ltz"` (sem token AT/MT/CVT) → regex não casa → `'—'`.
- A `plate-lookup` (linha 290) **já extrai** `caixa_cambio` da API de placa. Além disso, a **descrição da FIPE escolhida** quase sempre contém `MANUAL/AUT/CVT/EASYTRONIC` e é usada internamente para escolher a variante (linhas 174-183), mas **nada disso é persistido**.
- Não há coluna `cambio` em `veiculos`, `contratos` ou `cotacoes` (confirmado via `information_schema`). A única ocorrência de `cambio` no código de frontend é um campo TS em `Veiculos.tsx:64` (type local, sem ligação com o banco).

Sem persistência, o termo não tem como saber o câmbio de um Cobalt LTZ.

---

## Plano de correção

### 1. Migration — adicionar a coluna em três níveis

```sql
ALTER TABLE public.veiculos    ADD COLUMN IF NOT EXISTS cambio TEXT;
ALTER TABLE public.cotacoes    ADD COLUMN IF NOT EXISTS veiculo_cambio TEXT;
ALTER TABLE public.contratos   ADD COLUMN IF NOT EXISTS veiculo_cambio TEXT;
```

Domínio canônico: `'manual' | 'automatico'` (mesmo padrão de `combustivel`, sem CHECK para permitir backfills históricos com NULL).

Backfill best-effort em `veiculos`: rodar regex equivalente a `inferirCambio` direto em SQL para preencher os casos óbvios (modelo contém `AUT/CVT/AT/MANUAL/MT/...`). Demais ficam NULL.

### 2. Extração — `plate-lookup` (server)

Em `supabase/functions/plate-lookup/index.ts`, normalizar e robustecer:

- Calcular `cambioNormalizado` combinando **duas fontes**, nessa ordem:
  1. `veiculo.caixa_cambio` / `veiculo.cambio` retornado pela API
  2. Token detectado na **descrição da FIPE escolhida** (`MANUAL`, `MEC`, `AUT`, `AUTOMÁTICO`, `CVT`, `EASYTRONIC`, `DCT`, `TIPTRONIC`, `S-TRONIC`, `MULTIDRIVE`, `DUALOGIC`, `I-MOTION`, `AUTOMATIZAD`)
- Devolver no `vehicleData` já normalizado: `cambio: 'manual' | 'automatico' | null` (mantém compat para quem lia o campo bruto).

### 3. Persistência — fluxo de cotação

- `CotacaoFormDialog` (e `EtapaConsultaFipe` no link público): ao receber o resultado da `plate-lookup`, gravar `cotacoes.veiculo_cambio` no insert/update. **Se o operador trocar a variante FIPE** no seletor existente, recalcular o câmbio a partir da nova descrição (a UI já mostra "confira combustível/câmbio/motorização" — só falta usar).
- Ao criar/atualizar o registro do veículo, copiar para `veiculos.cambio`.
- `contrato-gerar` (e variantes públicas): snapshot `contratos.veiculo_cambio = cotacoes.veiculo_cambio ?? veiculos.cambio`.

### 4. Leitura — termo de afiliação

Em `supabase/functions/_shared/termo-afiliacao-utils.ts` (linha 456), trocar:

```ts
cambio: inferirCambio(contrato.veiculo_modelo || veiculo.veiculo_modelo)
```

por hierarquia real → fallback no final:

```ts
cambio:
  formatarCambio(contrato.veiculo_cambio)
  ?? formatarCambio(veiculoDB?.cambio)
  ?? formatarCambio(veiculo.veiculo_cambio)
  ?? inferirCambio(contrato.veiculo_modelo || veiculo.veiculo_modelo)
```

`formatarCambio('manual') → 'Manual'`, `'automatico' → 'Automático'`, qualquer outro/NULL → `null`. `inferirCambio` permanece como último recurso para contratos antigos sem snapshot.

### 5. Correção pontual do OPO9H00

Após a migration, rodar manualmente:

```sql
UPDATE veiculos  SET cambio = '<correto>' WHERE placa = 'OPO9H00';
UPDATE contratos SET veiculo_cambio = '<correto>' WHERE id = '<contrato_id>';
```

Para escolher entre `'manual'` e `'automatico'` preciso confirmar com o CRLV.

---

## Arquivos impactados

- `supabase/migrations/<nova>.sql` — colunas + backfill
- `supabase/functions/plate-lookup/index.ts` — normalizar/devolver câmbio
- `supabase/functions/_shared/termo-afiliacao-utils.ts` — hierarquia + `formatarCambio`
- `supabase/functions/contrato-gerar/index.ts` (+ variantes públicas) — snapshot
- `src/components/cotacoes/CotacaoFormDialog.tsx` — persistir câmbio do lookup / seletor FIPE
- `src/components/cotacao/EtapaConsultaFipe.tsx` — idem para cotação pública

---

## Pergunta para destravar

O Chevrolet **Cobalt LTZ 2013 placa OPO9H00** é **Manual** ou **Automático**? Já corrijo o registro logo após aprovar a migration.
