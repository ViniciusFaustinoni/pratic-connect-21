# Beneficio (5 endpoints)

Base URL: `https://api.hinova.com.br/api/sga/v2`. Todos os endpoints (exceto `/usuario/autenticar`) exigem header `Authorization: Bearer <token_usuario>`.

---

## `POST /alterar/beneficio` — Alterar

Altera informações de um benefício específico


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_beneficio` | Number | sim | Código do benefício a ser alterado |
| `codigo_classificacao_beneficio` | Number | não | Código da categoria a qual o benefício deve pertencer. |
| `idade_beneficiario_inicial` | Number | não | Idade mínima que o beneficiário deve ter para poder adquirir este benefício. |
| `idade_beneficiario_final` | Number | não | Idade máxima que o beneficiário deve ter para poder adquirir este benefício. |
| `descricao` | String | não | Descrição do benefício. |


**Exemplo Requisição:**
```json
    	{
    		"codigo_beneficio" : "9",
      	"codigo_classificacao_beneficio" : "99",
"idade_beneficiario_inicial" : "9",
"idade_beneficiario_final" : "99",
"descricao" : "BENEFÍCIO"
      }
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"codigo_beneficio": 9
}
```


---

## `POST /beneficiario/vincular-beneficio` — Vincular

Vincular uma lista de benefícios ao beneficiário de acordo com o array de benefícios


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_beneficiario` | Number | sim | Código do beneficiário retornado pelo método de inserção ou consulta beneficiário |
| `beneficios` | Array | sim | Array contendo os códigos do(s) benefício(s) |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `mensagem` | String | sim | Mensagem de retorno |
| `codigobeneficiario` | String | sim | Código do beneficiário que recebeu o vínculo dos benefícios |
| `beneficios_vinculados` | String | sim | Array contendo informações dos benefícios vinculados ao beneficiário |
| `beneficios_nao_vinculados` | String | sim | Array contendo os benefícios que não foi possível vincular ao beneficiário. Obs: Esta posição só irá aparecer caso algum dos benefícios enviados não possa ser vinculado ao beneficiário |


**Exemplo Requisição:**
```json
{
"codigo_beneficiario" :	"9",
"beneficios": [
"9",
"99",
"999"	
]
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_beneficiario": "9",
"beneficios_vinculados": [
{
"codigo_beneficio": "99",
"descricao_beneficio": "ASSISTÊNCIA",
"codigo_fornecedor": "999"
}
],
"beneficios_nao_vinculados": [
{
"codigo_beneficio": "99",
"alerta": "Benefício não disponível para este perfil de beneficiário"
}
]
}
```


---

## `POST /vincular-remover/beneficio` — Vincular ou remover benefício

Vincula ou exclui benefícios a um beneficiário


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_beneficiario` | Number | sim | Código do beneficiário |
| `beneficios_adicionar` | Array | sim | Array contendo os códigos dos benefícios a serem inseridos |
| `beneficios_remover` | Array | sim | Array contendo os códigos dos benefícios a serem removidos |


**Exemplo Requisição:**
```json
    	{
     		"codigo_beneficiario" : 999,
"beneficios_adicionar" : [
"1",
"2"
],
"beneficios_remover" : [
"3"
]
  	}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
{
"codigo_beneficio": 1,
"mensagem": "Benefício adicionado"
},
{
"codigo_beneficio": 2,
"mensagem": "Benefício adicionado"
},
{
"codigo_beneficio": 3
"mensagem": "Benefício removido"
}
]
```


---

## `GET listar/beneficio-por-situacao/:situacao` — Listar

Lista benefícios de acordo com a situação


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | Number | sim | Situação do benefício |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_beneficio": "9",
"decricao_beneficio": "Benefício Hinova",
"valor_beneficio": "999.99",
"idade_beneficiario_inicial": 9,
"idade_beneficiario_final": 99,
"padrao": "N",
"id_classificacaobeneficio": 9,
"classificacao_beneficio": "BENEFICIO"
}
```


---

## `GET listar/classificacao-beneficio/:situacao` — Listar Classificação

Lista as classificações de benefício de acordo com a situação enviada


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | Number | sim | Situação do da classificação |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
{
"codigo_classificacaobeneficio": "9",
"descricao": "BENEFICIO ADICIONAL",
"situacao": "ATIVO"
}
]
```


---
