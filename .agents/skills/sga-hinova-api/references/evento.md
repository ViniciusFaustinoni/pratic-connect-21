# Evento (6 endpoints)

Base URL: `https://api.hinova.com.br/api/sga/v2`. Todos os endpoints (exceto `/usuario/autenticar`) exigem header `Authorization: Bearer <token_usuario>`.

---

## `POST evento-aberto/listar` — Listar Eventos Abertos

Lista a quantidade de eventos abertos em um determinado período de tempo


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `data_inicial` | String | sim | Data inicial da pesquisa. Formato dd/mm/yyyy |
| `data_final` | Number | sim | Data final da pesquisa. Formato dd/mm/yyyy] |


**Exemplo Retorno:**
```json
{
    "mensagem": "OK",
    "eventos_abertos": "9"
}
```


---

## `POST evento-finalizado/listar` — Listar Eventos Finalizados

Lista a quantidade de eventos finalizados em um determinado período de tempo


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `data_inicial` | String | sim | Data inicial da pesquisa. Formato dd/mm/yyyy |
| `data_final` | Number | sim | Data final da pesquisa. Formato dd/mm/yyyy] |


**Exemplo Retorno:**
```json
{
    "mensagem": "OK",
    "eventos_finalizados": "9"
}
```


---

## `GET evento-sem-alteracao/listar/:quantidade_dias/:codigo_situacao` — Listar Eventos Sem Alteração

Lista os eventos que estão a x dias sem alteração na situação deles


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `quantidade_dias` | String | sim | Quantidade de dias considerados para buscar eventos que estão sem atualização |
| `codigo_situacao` | String | sim | Código da situação dos eventos a serem buscados |


**Exemplo Retorno:**
```json
{
   "mensagem": "OK",
   "quantidade_evento_fora_prazo": 2,
   "eventos_fora_prazo": [
     {
       "codigo_evento": "99",
       "protocolo_evento": "201999",
       "data_cadastro": "2019-06-25T00:00:00-0300"
     },
     {
       "codigo_evento": "9",
       "protocolo_evento": "20199",
       "data_cadastro": "2019-06-28T00:00:00-0300"
     }
   ]
 }
```


---

## `GET listar/evento-veiculo/:placa_ou_codigo` — Listar por veículo

Lista os eventos de um determinado veículo


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `placa_ou_codigo` | String | sim | PLaca ou código do veículo a ser consultado |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
    "token_fornecedor": "999999999999999999999999999999999999999999999999",
    "eventos": [
        {
            "codigo_evento": "99",
            "protocolo": "99999"
        }
    ]
}
```


---

## `GET situacao-evento/listar/:situacao` — Listar Situações Evento

Lista as situações de evento disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação das situações de evento a serem retornadas, se a situação for "todos", serão retornadas todas as situações de evento, independente de estarem ativas ou inativas |


**Exemplo Retorno:**
```json
 [
     {
      "codigo_eventosituacao": "9",
      "descricao": "ABERTO",
      "situacao": "ATIVO"
    },
    {
      "codigo_eventosituacao": "99",
      "descricao": "FINALIZADO",
      "situacao": "ATIVO"
    }
]
```


---

## `GET veiculo-reparo-oficina/listar` — Veículos por Oficina/Fornecedor

Retorna a quantidade de Veículos por Oficina/Fornecedor


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Exemplo Retorno:**
```json
[
  {
    "codigo_fornecedor_oficina": 99,
    "quantidade_veiculos": "9"
  }
]
```


---
