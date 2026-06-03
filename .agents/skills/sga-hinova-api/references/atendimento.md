# Atendimento (5 endpoints)

Base URL: `https://api.hinova.com.br/api/sga/v2`. Todos os endpoints (exceto `/usuario/autenticar`) exigem header `Authorization: Bearer <token_usuario>`.

---

## `POST /cadastrar/historico-atendimento-associado` — Cadastrar Hist. Associado


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_associado` | Number | sim | Código do associado atendido. Opcional caso esteja enviando o cpf |
| `cpf` | String | não | CPF do associado atendido. Marcara: 999.999.999-99, 99.999.999/9999-99 ou somente números. Opcional caso esteja mandando o codigo_associado |
| `codigo_status_atendimento` | Number | sim | Código do status no qual se encontra o atendimento |
| `codigo_tipo_atendimento` | Number | sim | Código do tipo do atendimento |
| `codigo_departamento` | Number | sim | Código do departamento do atendimento |
| `titulo` | String | sim | Título do atendimento |
| `descricao` | String | sim | Descrição do atendimento |
| `codigo_terceiro` | Number | não | Código do terceiro atendido. Opcional |
| `placa` | String | não | Placa do veículo do atendido. |
| `valor_atendimento` | String | não | Valor de atendimento. |
| `codigo_fornecedor` | String | não | Código do fornecedor. |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `mensagem` | String | sim | Mensagem de retorno |
| `codigo_historico_atendimento` | String | sim | Código do histórico de atendimento cadastrado na base de dados |


**Exemplo Requisição:**
```json
{
"codigo_associado" : "9"
"cpf" : "999.999.999-99",
"codigo_terceiro" : "999",
"codigo_status_atendimento" : "99999",
"codigo_tipo_atendimento" : "9",
"codigo_departamento" : "9",
"titulo" : "Atendimento",
"descricao" : "Atendimento Hinova",
"placa" : "AAA-1111"
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"codigo_historico_atendimento": "999"
}
```


---

## `GET buscar/historico-atendimento-associado/:cpf` — Busca Hist. Associado

Busca todos os atendimentos de um determinado associado


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{	
"codigo_associado": 999,
"nome_associado": "HINOVA",
"rg_associado": "MG 999999999",
"cpf_associado": "999.999.999-99",
"telefone_fixo": "(99) 9999-9999",
"telefone_celular": "(99) 99999-9999",
"telefone_celular_aux": "(99)9999-9999",
"telefone_comercial": "(99)9999-9999",
"e-mail": "hinova@hinova.com.br",
"descricao_situacao": "ATIVO"
"historico_atendimento": [
{
"codigo_atendimento": 99,
"descricao_status_atendimento": "FINALIZADO",
"descricao_tipo_atendimento": "ASSISTÊNCIA 24H",
"descricao_departamento": "CADASTRO",
"titulo": "RASTREADOR",
"descricao": "RASTREAMENTO",
"data_cadastro": "yyyy-mm-dd",
"hora_cadastro": "00:00:00"
},
{
"codigo_atendimento": 9999,
"descricao_status_atendimento": "CANCELADO",
"descricao_tipo_atendimento": "GERAÇÃO  COBRANÇA",
"descricao_departamento": "FINANCEIRO",
"titulo": "GERAÇÃO CARTA DE COBRANÇA",
"descricao": "CARTA DE COBRANÇA GERADA",
"data_cadastro": "yyyy-mm-dd",
"hora_cadastro": "00:00:00"
}
]
}
```


---

## `GET listar/departamento/:situacao` — LIstar departamento

Lista os departamentos que estão na situação enviada


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_departamento": "99",
"descricao": "CADASTRO"
},
{
"codigo_departamento": "999",
"descricao": "FINANCEIRO"
}
```


---

## `GET listar/status-atendimento/:situacao` — Listar status

Lista os status de atendimento que estão na situação enviada


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_statusatendimento": "9",
"descricao": "INADIMPLENTE"
},
{
"codigo_statusatendimento": "99",
"descricao": "PAGO"
}
```


---

## `GET listar/tipo-atendimento/:situacao` — Listar tipo

Lista os tipos de atendimento que estão na situação enviada


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_tipoatendimento": "9",
"descricao": "RECLAMAÇÃO"
},
{
"codigo_tipoatendimento": "99",
"descricao": "ASSISTÊNCIA 24H"
}
```


---
