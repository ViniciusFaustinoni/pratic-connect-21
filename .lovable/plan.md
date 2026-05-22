## Diagnóstico

A coluna **Uso App** em `/cadastro/veiculos` lê `veiculos.uso_aplicativo` e `veiculos.plataforma_app`. Mas o dado está sendo gravado em outro lugar:

| Tabela | `uso_aplicativo = true` | `plataforma_app` preenchido |
|---|---|---|
| `veiculos` | **1** | **0** |
| `contratos` | 54 | (coluna não existe) |
| `cotacoes` | 269 | (coluna não existe) |

`contrato-gerar` grava `uso_aplicativo` em `contratos` (linha 1156) mas **não propaga** para `veiculos`. Resultado: 100% da coluna mostra "-".

`plataforma_app` só é gravada em `veiculos` pelos fluxos manuais (`AssociadoFormDialog`, `StepNovoVeiculo` da substituição) e não existe em `contratos`/`cotacoes`.

## Mudanças

### 1. Edge — `supabase/functions/contrato-gerar/index.ts`
No bloco que faz INSERT/UPDATE em `veiculos` (mesmo trecho do snapshot do contrato), incluir:
```ts
uso_aplicativo: cotacao.uso_aplicativo || false,
```
Sem tocar em `plataforma_app` (não existe no payload da cotação) — segue sendo "App" genérico quando o operador não preenche manualmente.

### 2. Migration de backfill — `veiculos.uso_aplicativo`
Para os 54 veículos com contrato ativo `uso_aplicativo=true`:
```sql
UPDATE public.veiculos v
SET uso_aplicativo = true
FROM public.contratos c
WHERE c.veiculo_id = v.id
  AND c.uso_aplicativo = true
  AND v.uso_aplicativo IS DISTINCT FROM true;
```
(insert tool, não migration de schema)

### 3. Página `/cadastro/veiculos` (Veiculos.tsx)
Nenhuma alteração — a coluna já está correta lendo de `veiculos.uso_aplicativo` + `plataforma_app`. Só depende dos dois ajustes acima.

## Fora do escopo
- Adicionar `plataforma_app` em `contratos`/`cotacoes` (exige novo campo no formulário de cotação — não foi pedido).
- Outros fluxos de criação/edição de veículo (já gravam o campo direto).

## Resultado esperado
- Veículos antigos com app: mostram badge "App" (sem plataforma específica, pois nunca foi capturada).
- Veículos novos a partir desta correção: continuam mostrando "App" até alguém cadastrar a plataforma manualmente, mas a flag fica correta.