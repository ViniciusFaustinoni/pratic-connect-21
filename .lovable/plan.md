# Por que as fotos do LMX5A90 não aparecem em todos os menus

## Diagnóstico

Veículo `LMX5A90` (id `3a05032d-…`, contrato `3388240f-…`, cotação `7d3040a5-…`).

Existe **1 vistoria** (`5efff1eb-adcc-4ac0-8fb6-0f0d965e89c9`, presencial, status `concluida`) com **31 fotos** em `vistoria_fotos`. Porém:

```
vistorias.veiculo_id = NULL
vistorias.contrato_id = 3388240f-…   ✓
vistorias.cotacao_id  = 7d3040a5-…   ✓
vistorias.instalacao_id = 3ae909be-… ✓ (instalacoes.veiculo_id = 3a05032d-… ✓)
```

O hook canônico **`useFotosVistoriaPorVeiculo`** (`src/hooks/useVeiculoDetalhes.ts`) filtra estritamente por `vistorias.veiculo_id`. Como o campo está NULL nessa vistoria, o drawer **Detalhes do Veículo → aba Fotos/Docs** mostra "Nenhuma foto de vistoria", mesmo com 31 fotos no banco.

Telas que leem por `contrato_id` / `cotacao_id` / `vistoria_id` (Cadastro, Monitoramento, Análise) exibem as fotos normalmente — por isso a propagação fica parcial.

Causa: a vistoria foi materializada antes da regra "vistoria nunca órfã" garantir `veiculo_id`. A memória atual (`mem://logic/operations/vistoria-vinculos-obrigatorios`) cita autopreenchimento de `contrato_id/cotacao_id/associado_id`, mas **não** garante `veiculo_id`.

## Plano

### 1. Migration — backfill + reforço do trigger

`supabase/migrations/<ts>_vistorias_veiculo_id_canonico.sql`:

- **Backfill** em duas etapas (idempotente):
  1. `UPDATE vistorias v SET veiculo_id = i.veiculo_id FROM instalacoes i WHERE v.instalacao_id = i.id AND v.veiculo_id IS NULL AND i.veiculo_id IS NOT NULL;`
  2. Fallback para vistorias sem `instalacao_id`: derivar via `contratos → veiculos` (último veículo ativo do contrato).
- **Atualizar `fn_vistoria_autopreencher_vinculos`** (trigger BEFORE INSERT/UPDATE) para também resolver `NEW.veiculo_id` quando NULL, na ordem: `instalacoes.veiculo_id` → `contratos→veiculos` (1 único veículo ativo) → mantém NULL se ambíguo.
- Log de saneamento na tabela de auditoria habitual.

### 2. Verificação

Após aplicar:
- `SELECT count(*) FROM vistorias WHERE veiculo_id IS NULL AND instalacao_id IS NOT NULL` → 0.
- Recarregar drawer do LMX5A90 → aba **Fotos/Docs** mostra as 31 fotos.

### 3. Memória

Atualizar `mem://logic/operations/vistoria-vinculos-obrigatorios` para incluir `veiculo_id` no autopreenchimento e citar o saneamento histórico.

## Fora do escopo

- Não mexer no front (hook canônico já está correto).
- Não tocar em fluxo de criação de vistoria nas edges — o trigger DB cobre todos os caminhos.
