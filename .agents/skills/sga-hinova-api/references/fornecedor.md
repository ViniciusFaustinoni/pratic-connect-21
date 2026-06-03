# Fornecedor (2 endpoints)

Base URL: `https://api.hinova.com.br/api/sga/v2`. Todos os endpoints (exceto `/usuario/autenticar`) exigem header `Authorization: Bearer <token_usuario>`.

---

## `GET fornecedor/buscar/:cpf_cnpj` — Buscar

Busca um fornecedor pelo CPF ou CNPJ dele.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `cpf_cnpj` | String | sim | CPF ou CNPJ do fornecedor a ser pesquisado. |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
    "mensagem": "OK",
    "codigo_fornecedor": "99",
    "nome": "HINOVA SOLUÇÕES DIGITAIS",
    "nome_fantasia": "HINOVA",
    "cpf_cnpj": "9999999999",
    "telefone": "(11)1111-11111",
    "email": "hinova@hinova.com",
    "situacao": "A"
}
```


---

## `POST fornecedor/cadastrar` — Cadastrar

Cadastra um fornecedor na base de dados.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `cpf` | String | sim | CPF ou CNPJ válido do fornecedor. Mascara: 999.999.999-99, 99.999.999/9999-99 ou somente números |
| `nome` | String | sim | Nome do fornecedor |
| `telefone` | String | sim | Número de telefone da cooperativa. Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999 |
| `nome_fantasia` | String | não | Nome fantasia do fornecedor |
| `logradouro` | String | não | Logradouro do fornecedor |
| `numero` | String | não | Número do fornecedor |
| `complemento` | String | não | Complemento do fornecedor |
| `bairro` | String | não | Bairro do fornecedor |
| `cidade` | String | não | Cidade do fornecedor |
| `estado` | String | não | Estado do fornecedor. Informar DESCRIÇÃO ou SIGLA |
| `cep` | String | não | Cep do fornecedor. Mascara: 99999-999 ou 99.999-999 ou somente números |
| `email` | String | não | e-Mail do fornecedor. |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `mensagem` | String | sim | Mensagem de retorno |
| `codigo_fornecedor` | String | sim | Código do fornecedor inserido na base de dados |


**Exemplo Requisição:**
```json
{
    "cpf" : "999.999.999-99",
    "nome" : "HINOVA SOLUÇÕES DIGITAIS",
    "nome_fantasia" : "HINOVA", 
    "telefone" : "(31) 99999999"
    "logradouro" : "Rua Manoel Elias de Aguiar",
    "numero" : "245",
    "complemento" : "Comercial",
    "bairro" : "Ouro Preto",
    "cidade" : "Belo Horizonte",
    "estado" : "Minas Gerais",
    "cep" : "31.330-520",
    "telefone" : "(99) 99999-9999",
    "email" : "teste@hinova.com.br"
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
    "mensagem" : "OK",
    "codigo_fornecedor" : 999999
}
```


---
