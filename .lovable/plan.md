

# Atualizar Documentação da API com Campos e Endpoints Recentes

## O que está faltando

| Recurso | O que falta na documentação |
|---|---|
| **Associados POST** | Campo `cnh_validade` (date) |
| **Associados GET** | Campos `cnh_validade`, `data_contrato`, `data_contrato_final` no response example |
| **Veículos POST** | Campo `valor_fipe_protegido` (numeric) |
| **Veículos GET** | Campo `valor_fipe_protegido` no response example |
| **Sinistros POST** | 16 campos novos: `valor_fipe`, `valor_participacao`, `valor_orcamento`, `valor_indenizacao`, `valor_pago`, `percentual_fipe`, `tipo_dano`, `veiculo_recuperado`, `envolvimento`, `data_comunicado`, `solicitou_carro_reserva`, `valor_depreciacao`, `local_ocorrencia`, `estado_ocorrencia`, `cidade_ocorrencia` |
| **Sinistros GET/:id** | Response enriquecido com dados do associado e veículo embutidos |
| **Sinistros GET (listagem)** | Endpoint novo `GET /sinistros?associado_cpf=X&status=Y` com paginação — não existe na documentação |

## Alterações

### `src/components/api-docs/apiEndpoints.ts`

1. **POST Associados** — adicionar campo `cnh_validade` nos fields e no responseExample
2. **GET Associados** — adicionar `cnh_validade`, `data_contrato`, `data_contrato_final` no responseExample
3. **POST Veículos** — adicionar campo `valor_fipe_protegido` nos fields
4. **GET Veículos** — adicionar `valor_fipe_protegido` no responseExample
5. **POST Sinistros** — adicionar os 16 campos novos nos fields
6. **GET Sinistros/:id** — atualizar responseExample com dados enriquecidos (associado + veículo)
7. **Novo endpoint: GET Sinistros (listagem)** — adicionar entrada com filtros `associado_cpf`, `status`, `limit`, `offset`

## Arquivo

| Arquivo | Ação |
|---|---|
| `src/components/api-docs/apiEndpoints.ts` | Adicionar campos faltantes e novo endpoint de listagem de sinistros |

