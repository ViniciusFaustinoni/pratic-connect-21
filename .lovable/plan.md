
# Endpoint de Rastreadores na API Externa + Vinculação Automática

## Contexto

Hoje a API externa (`api-externa/index.ts`) não possui endpoint para rastreadores. Quando associados e veículos são criados via API, não há como incluir o rastreador correspondente. A tabela `rastreadores` já possui `veiculo_id`, `associado_id`, `associado_email`, `imei`, `codigo`, `plataforma`, `status`.

## Alterações

### 1. `supabase/functions/api-externa/index.ts` — Novo endpoint `rastreadores`

**POST /rastreadores**:
- Campos obrigatórios: `imei`, `codigo`, `plataforma` (default: `rede_veiculos`)
- Campos opcionais: `numero_serie`, `chip_iccid`, `id_plataforma`, `veiculo_id`, `veiculo_placa`, `associado_id`, `associado_cpf`, `associado_email`, `status` (default: `estoque`)
- Se `veiculo_placa` for informado (sem `veiculo_id`), busca o veículo pelo placa
- Se `associado_cpf` for informado (sem `associado_id`), busca o associado pelo CPF
- Se o `status` for `instalado` e houver `veiculo_id`, vincula automaticamente
- Retorna o rastreador criado

**GET /rastreadores/:id**:
- Retorna rastreador com dados do veículo e associado

### 2. `supabase/functions/api-externa/index.ts` — Vincular rastreador ao criar veículo (opcional)

No POST de veículos, aceitar campo opcional `rastreador_imei`. Se informado:
- Busca rastreador no estoque pelo IMEI
- Se encontrado, atualiza `veiculo_id`, `associado_id` e `status = 'instalado'`
- Se não encontrado, ignora silenciosamente (ou retorna warning no response)

### 3. `src/components/api-docs/apiEndpoints.ts` — Documentação

Adicionar endpoint de rastreadores na documentação da API com campos, exemplos de request/response.

## Fluxo esperado via API

```text
1. POST /associados → cria associado (retorna id)
2. POST /veiculos   → cria veículo vinculado ao associado (retorna id)
3. POST /rastreadores → cria rastreador vinculado ao veículo/associado
   OU
2. POST /veiculos { rastreador_imei: "123..." } → cria veículo E vincula rastreador existente
```

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/api-externa/index.ts` | Novo endpoint POST/GET rastreadores + campo `rastreador_imei` no POST veículos |
| `src/components/api-docs/apiEndpoints.ts` | Documentar novo endpoint de rastreadores |
