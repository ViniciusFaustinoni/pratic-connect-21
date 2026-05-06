# Correção: "Portas: 2" em motos no termo de afiliação

## Causa raiz

`supabase/functions/plate-lookup/index.ts` linha **276**:

```ts
numero_portas: veiculo.quantidade_passageiro || veiculo.qt_portas || veiculo.quantidade_passageiros || '',
```

A API de placas retorna `quantidade_passageiro = 2` para motos (piloto + garupa). Como esse campo é o **primeiro** do `||`, ele vence sempre — e vai parar em `cotacoes.numero_portas` → `contratos.veiculo_numero_portas` → template do termo, gerando "Portas: 2" para CB300, Twister, Kwid (em moto), etc.

O downstream (`_shared/termo-afiliacao-utils.ts` linhas 458-461) já está correto: lê do contrato → veiculo DB → cotação. O problema é exclusivamente na **origem** (plate-lookup).

## Correção

### 1. `supabase/functions/plate-lookup/index.ts` (linha 276)

Substituir o fallback por lógica que:
- **Detecta moto** via `tipo_de_veiculo` / `tipo_veiculo` / `especie` / `categoria` (regex `MOTO|MOTOCICLETA|CICLOMOTOR|TRICICLO|QUADRICICLO`) → força `numero_portas = 0`.
- Para demais veículos, só aceita campos que **de fato** representam portas: `qt_portas`, `numero_portas`, `quantidade_portas`. Nunca `quantidade_passageiro(s)`.
- Retorna `''` quando ausente (sem chutar valor).

### 2. Backfill dos casos já gravados

Reset em massa para corrigir contratos/cotações já contaminados:

```sql
-- Cotações: zerar portas onde o veículo é moto
UPDATE public.cotacoes c
SET numero_portas = 0
FROM public.marcas_modelos mm
WHERE c.modelo_id = mm.id
  AND mm.categoria ILIKE '%moto%'
  AND c.numero_portas IS DISTINCT FROM 0;

-- Contratos: idem (snapshot)
UPDATE public.contratos ct
SET veiculo_numero_portas = 0
WHERE LOWER(COALESCE(ct.veiculo_categoria,'')) ~ 'moto'
  AND ct.veiculo_numero_portas IS DISTINCT FROM 0;

-- Veículos: idem
UPDATE public.veiculos v
SET numero_portas = 0
FROM public.marcas_modelos mm
WHERE v.modelo_id = mm.id  -- ajustar coluna real de vínculo
  AND mm.categoria ILIKE '%moto%'
  AND v.numero_portas IS DISTINCT FROM 0;
```

(Confirmo as colunas reais de vínculo modelo↔veículo antes de aplicar.)

## Auditoria dos demais campos do termo

Revisado `plate-lookup` (linhas 256-278) e `termo-afiliacao-utils.ts` (linhas 420-490). Status atual:

| Campo termo | Origem | Status |
|---|---|---|
| placa, chassi, renavam, motor | direto da API | OK |
| marca/modelo | split de `marca_modelo` por "/" | OK |
| ano fab / ano modelo | normalização 3 cenários | OK |
| cor, combustível | direto | OK |
| categoria CRLV (Particular/Aluguel) | `resolverCategoriaCrlv(uso, app)` | OK |
| tipo_veiculo (carro/moto) | `veiculo_categoria` | OK |
| FIPE / código FIPE | ranking heurístico | OK |
| câmbio | `inferirCambio(modelo)` por nome | **frágil** — observar |
| **portas** | `quantidade_passageiro` || ... | **BUG (alvo deste fix)** |
| alienado, financeira, procedência | snapshot contrato | OK |
| blindado, flags depreciação | DB veículo | OK |
| dia_vencimento, valores | contrato | OK |

Único bug crítico identificado é o de portas. `inferirCambio` é heurístico mas fora do escopo desta correção.

## Validação

1. Após o fix, simular cotação com placa de moto (ex.: CB300) → conferir `numero_portas=0` retornado.
2. Gerar termo de afiliação de teste → conferir linha "Portas: —" ou "0".
3. Regerar/preview termo de cliente afetado para validar resultado.

## Arquivos alterados

- `supabase/functions/plate-lookup/index.ts` (1 bloco, ~12 linhas)
- 1 migration SQL para backfill (cotacoes/contratos/veiculos)
