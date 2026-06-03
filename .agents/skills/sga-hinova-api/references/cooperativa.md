# Cooperativa (3 endpoints)

Base URL: `https://api.hinova.com.br/api/sga/v2`. Todos os endpoints (exceto `/usuario/autenticar`) exigem header `Authorization: Bearer <token_usuario>`.

---

## `POST /cooperativa/cadastrar` — Cadastrar


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nome` | String | sim | Nome da cooperativa |
| `cpf` | String | sim | CPF ou CNPJ válido da cooperativa. Mascara: 999.999.999-99, 99.999.999/9999-99 ou somente números |
| `email` | String | sim | e-Mail da cooperativa. |
| `telefone` | String | sim | Número de telefone da cooperativa. Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999 |
| `contato` | String | não | Nome do contato responsável pela cooperativa |
| `logradouro` | String | não | Logradouro residêncial da cooperativa |
| `numero` | String | não | Número residêncial da cooperativa |
| `complemento` | String | não | Complemento residêncial da cooperativa |
| `bairro` | String | não | Bairro residêncial da cooperativa |
| `cidade` | String | não | Cidade residêncial da cooperativa |
| `estado` | String | não | Estado residêncial da cooperativa. Informar DESCRIÇÃO ou SIGLA |
| `cep` | String | não | Cep residêncial da cooperativa. Mascara: 99999-999 ou 99.999-999 ou somente números |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `mensagem` | String | sim | Mensagem de retorno |
| `codigo_cooperativa` | String | sim | Código da cooperativa inserido na base de dados |


**Exemplo Requisição:**
```json
{
    "nome": "Hinova Soluções Digitais",
    "cpf": "99.999.999/9999-99 ou 999.999.999-99",
    "contato": "Hinova",
    "logradouro": "Rua Manoel Elias de Aguiar",
    "numero": "245",
    "complemento": "Comercial",
    "bairro": "Ouro Preto",
    "cidade": "Belo Horizonte",
    "estado": "Minas Gerais",
    "cep": "31.330-520",
    "telefone": "(99) 99999-9999",
    "email": "teste@hinova.com.br"
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
    "mensagem": "OK",
    "codigo_cooperativa": 999999
}
```


---

## `GET cooperativa/buscar/:codigo_cooperativa` — Buscar

Busca a cooperativa pelo código, respeitando as permissões de cooperativa do usuário.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_cooperativa` | String | sim | Código da cooperativa a ser pesquisada. |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
    "codigo_cooperativa": "9",
    "nome": "HINOVA SOLUÇÕES DIGITAIS",
    "cpf": "9999999999",
    "contato": "HINOVA",
    "telefone": "(31)9999-9999",
    "email": "hinova@hinova.com.br",
    "logradouro": "MANOEL ELIAS DE AGUIAR",
    "numero": "245",
    "complemento": "",
    "bairro": "OURO PRETO",
    "cidade": "BELO HORIZONTE",
    "estado": "MG",
    "cep": "99998-999",
    "formato_pagamento": "R$",
    "valor_pagamento": "99.99",
    "formato_pagamento_residual": "%",
    "valor_pagamento_residual": "9.99",
    "situacao": "ATIVO"
}
```


---

## `GET listar/cooperativa/:situacao` — Listar

Lista as cooperativas disponíveis de acordo com a situação desejada e com a permissão do usuário, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação das cooperativas a serem retornadas, se a situação for "todos", serão retornadas todas as cooperativas não excluídas, independente de estarem ativas ou inativas |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
    "codigo_cooperativa": "9",
    "nome": "HINOVA SOLUÇÕES DIGITAIS",
    "cpf": "9999999999",
    "contato": "HINOVA",
    "telefone": "(31)9999-9999",
    "email": "hinova@hinova.com.br",
    "logradouro": "MANOEL ELIAS DE AGUIAR",
    "numero": "245",
    "complemento": "",
    "bairro": "OURO PRETO",
    "cidade": "BELO HORIZONTE",
    "estado": "MG",
    "cep": "99998-999",
    "formato_pagamento": "R$",
    "valor_pagamento": "99.99",
    "formato_pagamento_residual": "%",
    "valor_pagamento_residual": "9.99",
    "situacao": "ATIVO"
}
```


---
