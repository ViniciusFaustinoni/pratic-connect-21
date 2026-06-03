# Autenticacao (1 endpoints)

Base URL: `https://api.hinova.com.br/api/sga/v2`. Todos os endpoints (exceto `/usuario/autenticar`) exigem header `Authorization: Bearer <token_usuario>`.

---

## `POST /usuario/autenticar` — Autenticar Usuário

Método essencial para utilização dos demais endpoints da APIv2. Retorna um token autenticado, que permite acesso as demais requisições. Atenção: O token que é gerado por este endpoint não expira , portanto não é necessário fazer uma nova autenticação antes de cada requisição aos demais métodos.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `usuario` | String | sim | Usuário ATIVO do sistema SGA |
| `senha` | String | sim | Senha de acesso do sistema SGA |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `mensagem` | String | sim | Mensagem de retorno |
| `token_usuario` | String | sim | Token de acesso após autenticação. Este token deverá ser enviado nas demais requisições |


**Exemplo Requisição:**
```json
{
"usuario" 	:	"usuario",
 		"senha"		:	"senha"
  }
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
   	"mensagem"		: 	"OK",
   	"token_usuario"	:	"Hash do token de acesso"
}
```


---
