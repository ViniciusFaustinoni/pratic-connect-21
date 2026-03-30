

# Expandir Endpoint de Sinistros na API Externa

## Contexto

A tabela `sinistros` já possui campos equivalentes aos da Hinova. O endpoint atual aceita poucos campos no POST e o GET retorna `select('*')` apenas por ID. Faltam: campos adicionais no POST, listagem com filtros, e dados relacionados (associado, veículo, condutor).

## Mapeamento Hinova → Nosso Sistema

| Campo Hinova | Campo nosso (já existe na tabela) |
|---|---|
| `motivo` (FURTO, COLISÃO) | `tipo` (enum `tipo_sinistro`) |
| `situacao_evento` | `status` (enum `status_sinistro`) |
| `data_evento` + `hora_evento` | `data_ocorrencia` |
| `data_comunicado_evento` | — **novo campo**: `data_comunicado` |
| `envolvimento` (VITIMA/CAUSADOR) | — **novo campo**: `envolvimento` |
| `valor_reparo` | `valor_orcamento` ✅ |
| `valor_fipe` | `valor_fipe` ✅ |
| `participacao` | `valor_participacao` ✅ |
| `numero_bo` | `bo_numero` ✅ |
| `protocolo` | `protocolo` ✅ |
| `solicitou_carro_reserva` | — **novo campo**: `solicitou_carro_reserva` (boolean) |
| `valor_depreciacao_veiculo` | — **novo campo**: `valor_depreciacao` |
| `logradouro/cidade/estado/cep` | `local_descricao`, `cidade_ocorrencia`, `estado_ocorrencia` ✅ |
| condutor.nome/cpf | `condutor_nome`, `condutor_cnh` ✅ |

## Alterações

### 1. Migration — Adicionar 3 colunas na tabela `sinistros`

```sql
ALTER TABLE public.sinistros 
  ADD COLUMN IF NOT EXISTS data_comunicado date,
  ADD COLUMN IF NOT EXISTS envolvimento text,
  ADD COLUMN IF NOT EXISTS solicitou_carro_reserva boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_depreciacao numeric;
```

### 2. `supabase/functions/api-externa/index.ts`

**POST /sinistros** — expandir `optionalFields`:
- Adicionar: `valor_fipe`, `valor_participacao`, `valor_orcamento`, `valor_indenizacao`, `valor_pago`, `percentual_fipe`, `tipo_dano`, `veiculo_recuperado`, `envolvimento`, `data_comunicado`, `solicitou_carro_reserva`, `valor_depreciacao`, `local_ocorrencia`, `estado_ocorrencia`, `cidade_ocorrencia`

**GET /sinistros/:id** — enriquecer com joins:
```ts
.select(`*, associado:associados(id, nome, cpf, telefone, email), 
         veiculo:veiculos(id, placa, chassi, marca, modelo, ano_fabricacao, ano_modelo, valor_fipe)`)
```

**GET /sinistros?associado_cpf=X** — novo endpoint de listagem:
- Filtrar por `associado_cpf` (busca o associado, depois lista sinistros)
- Filtrar por `status` (opcional)
- Retornar lista com dados do associado e veículo embutidos
- Paginação via `limit` e `offset`

## Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Adicionar `data_comunicado`, `envolvimento`, `solicitou_carro_reserva`, `valor_depreciacao` |
| `supabase/functions/api-externa/index.ts` | Expandir POST com novos campos, enriquecer GET com joins, adicionar listagem com filtros |

