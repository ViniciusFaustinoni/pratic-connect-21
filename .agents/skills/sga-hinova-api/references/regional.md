# Regional (2 endpoints)

Base URL: `https://api.hinova.com.br/api/sga/v2`. Todos os endpoints (exceto `/usuario/autenticar`) exigem header `Authorization: Bearer <token_usuario>`.

---

## `POST /regional/cadastrar/` — Cadastrar


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nome` | String | sim | Nome da regional |
| `nome_fantasia` | String | sim | Nome fantasia da regional |
| `cnpj` | String | sim | CNPJ válido da regional. Mascara: 99.999.999/9999-99 ou somente números |
| `logradouro` | String | sim | Logradouro residêncial da regional |
| `numero` | String | sim | Número residêncial da regional |
| `complemento` | String | sim | Complemento residêncial da regional |
| `bairro` | String | sim | Bairro residêncial da regional |
| `cidade` | String | sim | Cidade residêncial da regional |
| `estado` | String | sim | Estado residêncial da regional. Informar DESCRIÇÃO ou SIGLA |
| `cep` | String | sim | Cep residêncial da regional. Mascara: 99999-999 ou 99.999-999 ou somente números |
| `telefone` | String | sim | Número de telefone da regional. Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999 |
| `email` | String | sim | e-Mail da regional. |
| `website` | String | não | Website da regional. |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `mensagem` | String | sim | Mensagem de retorno |
| `codigo_regional` | String | sim | Código da regional inserido na base de dados |


**Exemplo Requisição:**
```json
{
    "nome"              :   "Hinova Soluções Digitais",
    "nome_fantasia"     :   "Hinova",
    "cnpj"              :   "99.999.999/9999-99",
    "logradouro"        :   "Rua Manoel Elias de Aguiar",
    "numero"            :   "245",
    "complemento"       :   "Comercial",
    "bairro"            :   "Ouro Preto",
    "cidade"            :   "Belo Horizonte",
    "estado"            :   "Minas Gerais",
    "cep"               :   "31.330-520",
    "telefone"          :   "(99) 99999-9999",
    "email"             :   "teste@hinova.com.br",
    "website"           :   "https://www.hinova.com.br/"
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
    "mensagem"          :   "OK",
    "codigo_regional"  :   999999
}
```


---

## `GET listar/regional/:situacao` — Listar

Lista as regionais disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação das regionais a serem retornadas, se a situação for "todos", serão retornadas todas as regionais não excluídas, independente de estarem ativas ou inativas |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
    "codigo_regional": 9,
    "descricao_regional": "Hinova Soluções Digitais",
    "situacao": "ATIVO"
}
```


---
