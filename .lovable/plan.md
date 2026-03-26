

# Popular base de Marcas & Modelos via API pública FIPE

## API escolhida

A **API Parallelum FIPE** (`https://fipe.parallelum.com.br/api/v2`) é gratuita, sem autenticação, e fornece todas as marcas e modelos do mercado brasileiro (carros, motos e caminhões).

Endpoints relevantes:
- `GET /cars/brands` → lista todas as marcas de carros
- `GET /cars/brands/{brandId}/models` → lista modelos de uma marca
- Mesma estrutura para `motorcycles` e `trucks`

## Plano de implementação

### 1. Criar Edge Function `fipe-import-marcas`

Nova edge function que:
1. Consulta `GET /cars/brands` para obter todas as marcas
2. Para cada marca, consulta `GET /cars/brands/{id}/models`
3. Opcionalmente repete para `motorcycles` e `trucks`
4. Insere os resultados na tabela `marcas_modelos` com `ON CONFLICT DO NOTHING`
5. Retorna resumo (total de marcas/modelos importados)

Inclui rate limiting interno (delay entre requests) para não sobrecarregar a API pública.

### 2.