# Cota (2 endpoints)

Base URL: `https://api.hinova.com.br/api/sga/v2`. Todos os endpoints (exceto `/usuario/autenticar`) exigem header `Authorization: Bearer <token_usuario>`.

---

## `GET cota/buscar/:codigo_cota` — Buscar

Busca a cota pelo código, respeitando as permissões do usuário.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_cota` | Number | sim | Código da cota à ser pesquisado. |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_cota": "99",
"descricao_cota": "COTA 0,99",
"cota": "0.99",
"valor_cota": "9.99",
"valor_fipe_inicial": "0",
"valor_fipe_final": "99999",
"valor_adesao": "99",
"participacao_minima": "99",
"formato_cobranca": "%",
"porcentagem_fipe": "9",
"situacao": "ATIVO"
}
```


---

## `GET listar/cota/:codigo_regional/:codigo_cooperativa/:codigo_tipo_veiculo/:valor_fipe/:cilindrada` — Listar

Lista cotas de acordo com regional, cooperativa, tipo veículo, valor Fipe ou cilindrada


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_regional` | Number | sim | Código da regional na qual as cotas estão vinculadas |
| `codigo_cooperativa` | Number | sim | Código da cooperativa na qual as cotas estão vinculadas |
| `codigo_tipo_veiculo` | Number | sim | Código do tipo veículo |
| `valor_fipe` | String | sim | Valor protegido do veículo. Deve ser enviado com valor decimal Ex.: 100,00. Pode ser enviado 0 caso o veículo seja baseado em cilindrada. |
| `cilindrada` | String | sim | Cilindrada do veículo. Pode ser enviado 0 quando o veículo é baseado em valor fipe |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"cota": [
{
"codigo_cota": "99",
"cota": 9.99,
"descricao_cota": "COTA 9,99",
"valor_cota": "99.9999",
"valor_fipe_inicial": 999999,
"valor_fipe_final": 99999,
"valor_adesao": 9,
"participacao_minima": 99,
"porcentagem_fipe": 9,
"formato_cobranca": "R$",
"descricao_tipo_veiculo": "AUTOMÓVEL",
"regionais": [
{
"codigo_regional": "9",
"nome_regional": "HINOVA SOLUÇÕES DIGITAIS"
}
]
}
]
}
```


---
