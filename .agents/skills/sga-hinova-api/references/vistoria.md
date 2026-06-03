# Vistoria (5 endpoints)

Base URL: `https://api.hinova.com.br/api/sga/v2`. Todos os endpoints (exceto `/usuario/autenticar`) exigem header `Authorization: Bearer <token_usuario>`.

---

## `POST /cadastrar/vistoria` — Cadastrar vistoria

Cadastra uma vistoria vinculada a um associado


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_associado` | Number | sim | Código do associado para quem a vistoria foi feita |
| `codigo_vistoriador` | Number | sim | Código do vistoriador que realizou a vistoria |
| `codigo_tipo_vistoria` | Number | sim | Código do tipo da vistoria. |
| `data_vistoria` | String | sim | Data em que foi realizada a vistoria |
| `codigo_veiculo` | Number | não | Código do veículo vistoriado. |
| `codigo_estado_pneu` | Number | não | Código do estado do pneu. |
| `valor_vistoria` | Number | não | Valor da vistoria. |
| `observacao` | String | não | Obervação da vistoria. |
| `longitude` | String | não | Longitude da localização da vistoria. |
| `latitude` | String | não | Latitude do local da vistoria. |


**Exemplo Requisição:**
```json
{
    "codigo_associado" : 999,
    "codigo_vistoriador" : 9,
    "codigo_veiculo" : 99,
    "codigo_tipo_vistoria" : 9,
    "codigo_estado_pneu" : 9,
    "data_vistoria" : "dd/mm/yyyy",
    "observacao" : "feito pela api v2",
    "latitude" : "-99.9999",
    "longitude" : "-99.9999",
    "valor_vistoria" : "99,99"
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
    "mensagem": "OK",
    "codigo_vistoria": "999"
}
```


---

## `GET listar/estado-pneu/:situacao` — Listar tipo pneu

Lista os estados de pneu de acordo com o parâmetro "situação"


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação dos estados de pneu a serem retornados, se a situação for "todos", serão retornados todos os estados de pneu não excluídos, independente de estarem ativos ou inativos |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
    {
        "codigo_estadopneu": "9",
        "descricao": "NOVO",
        "situacao": "ATIVO"
    }
]
```


---

## `GET listar/tipo-foto/:situacao` — Listar tipo foto

Lista os tipos de foto de acordo com o parâmetro "situação"


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação dos tipos de fotos a serem retornados, se a situação for "todos", serão retornados todos os tipos de fotos não excluídos, independente de estarem ativos ou inativos |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
    {
        "codigo_tipofoto": "9",
        "descricao": "VISTORIA DE ADESÃO",
        "situacao": "ATIVO"
    }
]
```


---

## `GET listar/tipo-vistoria/:situacao` — Listar Tipo Vistoria.

Lista os tipos de vistoria de acordo com o parâmetro "situação"


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação dos tipos de vistoria a serem retornados, se a situação for "todos", serão retornados todos os tipos de vistoria não excluídos, independente de estarem ativos ou inativos |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
    {
        "codigo_tipo_vistoria": "9",
        "descricao": "VISTORIA DE ADESaO"
    }
]
```


---

## `GET listar/vistoriador/:situacao` — Listar Vistoriador

Lista os vistoriadores de acordo com o parâmetro "situação"


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação dos vistoriadores a serem retornados, se a situação for "todos", serão retornados todos os vistoriadores não excluídos, independente de estarem ativos ou inativos |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
    {
        "codigo_vistoriador": "9",
        "nome": "HINOVA",
        "cpf": "9999999999",
        "celular": "(99)99999-9999",
        "email": "hinova@hinova.com.br",
        "situacao": "ATIVO"
    }
]
```


---
