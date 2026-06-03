# Voluntario (10 endpoints)

Base URL: `https://api.hinova.com.br/api/sga/v2`. Todos os endpoints (exceto `/usuario/autenticar`) exigem header `Authorization: Bearer <token_usuario>`.

---

## `POST /listar/indicacao/` — Listar indicações

Lista todas as indicações vinculadas a um voluntario, podendo ser filtrado por data de inclusão


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_voluntario` | Number | sim | Código do voluntário que se deseja consultar |
| `data_indicacao_inicial` | String | não | Data de inclusão inicial da pesquisa das indicações. |
| `data_indicacao_final` | String | não | Data de inclusão final da pesquisa das indicações. Obrigatória caso seja enviada a data_indicacao_inicial |


**Exemplo Requisição:**
```json
{
"codigo_voluntario" : "99",
"data_indicacao_inicial" : "dd/mm/yyyy",
"data_indicacao_final" : "dd/mm/yyyy",
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"codigo_voluntario": 99,
"indicacoes": [
{
"codigo_indicacao": 9,
"codigo_veiculo_indicador": 999,
"codigo_veiculo_indicado": 9999
}
]
}
```


---

## `POST /listar/placas-por-voluntario/` — Listar placas

Lista todas as placas vinculadas a um voluntario, podendo ser filtrado por data e participação do fechamento


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_voluntario` | Number | sim | Código do voluntário que se deseja consultar |
| `participa_fechamento` | String | sim | Define se irão ser retornados apenas veículos que participam do fechamento ou não. Os valores válidos para este parâmetro são: "Y"(participa fechamento) ou "N"(não participam fechamento). Caso esse parâmetro não seja enviado, serão retornados veículos que participam e que não participam do fechamento |
| `tipo_retorno` | String | sim | Define as informações do retorno do método, se for analítico, irá retornar uma lista com as informações de cada veículo vinculado ao voluntário, caso seja sintético irá retornar apenas a quantidade de veículos vinculados ao voluntário. Os valores válidos para este parâmetro são: "sintetico" ou "analitico" |
| `data_cadastro_inicial` | String | não | Data de cadastro inicial da pesquisa dos veículos. Opcional |
| `data_cadastro_final` | String | não | Data de cadastro inicial da pesquisa dos veículos. Obrigatória caso seja enviada a data_cadastro_inicial |
| `data_contrato_inicial` | String | não | Data de contrato inicial da pesquisa dos veículos. Opcional |
| `data_contrato_final` | String | não | Data de contrato inicial da pesquisa dos veículos. Obrigatória caso seja enviada a data_contrato_inicial |


**Exemplo Requisição:**
```json
{
"codigo_voluntario": "99",
"data_pesquisa_inicial": "dd/mm/yyyy",
"data_pesquisa_final": "dd/mm/yyyy",
"participa_fechamento": "Y",
"tipo_retorno": "sintetico"
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"codigo_voluntario": 99,
"quantidade_veiculos": "9"
}
```

**Exemplo Requisição:**
```json
{
"codigo_voluntario" : "99",
"data_pesquisa_inicial" : "dd/mm/yyyy",
"data_pesquisa_final" : "dd/mm/yyyy",
"participa_fechamento" : "Y",
"tipo_retorno" : "analitico"
}
```

**Exemplo Retorno:**
```json
  HTTP/1.1 200 OK
{
"codigo_veiculo": "999",
"placa": "AAA1111",
"chassi": "999999999999",
"codigo_situacao": "9",
"descricao_situacao": "ATIVO",
"codigo_associado" :  "9",
"cpf_associado" : "9999999999"
}
```


---

## `POST /voluntario/cadastrar` — Cadastrar

Cadastra um novo voluntário, se o CPF do voluntário for igual a um existente na base, esse voluntário será alterado com os dados enviados na requisição. Quando um voluntário é alterado pelo método de cadastrar voluntário, não é possível alterar as cooperativas às quais ele está atrelado, Para alterar as cooperativas será preciso utilizar um método específico para isso.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nome` | String | sim | Nome do voluntário |
| `cpf` | String | sim | CPF do voluntário |
| `celular` | String | sim | Telefone celular do voluntário |
| `telefone_comercial` | String | sim | Telefone comercial do voluntário |
| `formato_pagamento` | String | sim | Formato de pagamento do voluntário(R ou %) |
| `valor_pagamento` | Number | sim | Valor do pagamento do voluntário |
| `cooperativas` | Array | sim | Array contendo o código das cooperativas que o voluntário estará atrelado |
| `codigo_classificacao` | Number | não | Código da classificação do voluntário. |
| `logradouro` | String | não | Logradouro do voluntário. |
| `numero` | Number | não | Número da residência do voluntário. |
| `complemento` | String | não | complemento da residência do voluntário. |
| `bairro` | String | não | Bairro do voluntário. |
| `cidade` | String | não | Cidade do voluntário. |
| `estado` | String | não | Estado do voluntário. |
| `cep` | String | não | CEP do voluntário. |
| `email` | String | não | E-mail do voluntário. |
| `obs` | String | não | Observações. |


**Exemplo Requisição:**
```json
{
"codigo_classificacao"	: 9,
"nome" : "Hinova Soluções Digitais",
"cpf" : "999.999.999-99",
"celular" : "(99)99999-9999",
"telefone_comercial" : "(99)9999-9999",
"formato_pagamento" : "R",
"valor_pagamento" : "999,00",
"logradouro" : "logradouro",
"numero" : "9",
"complemento" : "bloco 9",
"bairro" : "bairro",
"cidade" : "BH",
"estado" : "MG",
"cep" : "99999999",
"email" : "hinova@hinova.com.br",
"obs" : "observações",
"cooperativas" : [
{
"codigo_cooperativa" : "9"
},
{
"codigo_cooperativa" : "99"
},
{
"codigo_cooperativa" : "999"
}
]
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"codigo_voluntario": "131"
}
```


---

## `POST /voluntario/cadastrar-cooperativa/` — Vincular à cooperativa

Adiciona cooperativas ao voluntário


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_voluntario` | Number | sim | Código do voluntário ao qual se deseja adicionar as cooperativas |
| `array_cooperativas` | Array | sim | Array contendo o código das cooperativas que serão adicionadas ao voluntário |


**Exemplo Requisição:**
```json
{
"codigo_voluntario" : 999,
"array_cooperativas" : [
{
"codigo_cooperativa" : "9"
},
{
"codigo_cooperativa" : "999"
},
{
"codigo_cooperativa" : "99"
}
]
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"codigo_voluntario": "9999"
}
```


---

## `POST /voluntario/excluir-cooperativa/` — Remover de cooperativa

Exclui cooperativas atreladas a um voluntário


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_voluntario` | Number | sim | Código do voluntário ao qual se deseja adicionar as cooperativas |
| `array_cooperativas` | Array | sim | Array contendo o código das cooperativas que serão excluídas do voluntário |


**Exemplo Requisição:**
```json
{
"codigo_voluntario" : "9999",
"array_cooperativas" : [
{
"codigo_cooperativa" : "9"
},
{
"codigo_cooperativa" : "999"
},
{
"codigo_cooperativa" : "99"
}
]
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"codigo_voluntario": "9999"
}
```


---

## `GET buscar/voluntario/:cpdOuCodigo` — Buscar

Busca um voluntário pelo CPF ou código, respeitando as permissões de cooperativa do usuário.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `cpfOuCodigo` | String | sim | CPF ou código do voluntário a ser pesquisado. |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_voluntario": "99",
"nome": "HINOVA SOLUÇÕES DIGITAIS",
"cpf": "999999999999",
"telefone": "(99)9999-9999",
"celular": "(99)99999-99999",
"email": "hinova@hinova.com.br",
"logradouro": "RUA MANOEL ELIAS DE AGUIAR",
"numero": "245",
"complemento": "",
"bairro": "OURO PRETO",
"cidade": "BELO HORIZONTE",
"estado": "MG",
"data_cadastro" : "yyyy-mm-dd",
"situacao": "ATIVO",
"formato_pagamento": "R$",
"valor_pagamento": "99.99",
"formato_pagamento_residual": "%",
"valor_pagamento_residual": "9.99",
"cooperativas": [
{
"codigo_cooperativa": "9",
"nome_cooperativa": "HINOVA SOLUÇÕES DIGITAIS"
}
]
}
```


---

## `POST listar/alteracao-voluntario/` — Listar Alterações de Voluntários

Lista as alterações de voluntários em um intervalo de até 7 dias


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `data_inicial` | String | sim | Data inicial da pesquisa. Formato dd/mm/yyyy |
| `data_final` | Number | sim | Data final da pesquisa. Formato dd/mm/yyyy |
| `ultima_alteracao` | String | sim | Define se será exibida apenas a última alteração de cada voluntario . Formato "Y" ou "N". Opcional |
| `campos` | Array | sim | Array contendo o nome dos campos do voluntario que devem ser retornados |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
{
"codigo_alteracao": "99",
"codigo_voluntario": "9",
"nome": "HINOVA",
"codigo_cooperativa": "99",
"codigo_usuario": "9",
"situacao": "9",
"data_ocorrencia": "yyyy-mm-dd",
"hora_ocorrencia": "00:00:00",
"valor_anterior": {
"codigo_cooperativa": "9"
}
},
{
"codigo_alteracao": "999",
"codigo_voluntario": "99",
"nome": "HINOVA SOLUÇÕES DIGITAIS",
"codigo_cooperativa": "9",
"codigo_usuario": "9",
"situacao": "A",
"data_ocorrencia": "yyyy-mm-dd",
"hora_ocorrencia": "00:00:00",
"valor_anterior": {
"situacao": "I"
}
}
]
```


---

## `GET listar/situacao-adesao-voluntario/:codigo_voluntario` — Listar situação adesão

Lista as adesões feitas por um determinado voluntário


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_voluntario` | String | sim | Código do voluntário a ser consultado |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_voluntario": 99,
"nome_voluntario": "HINOVA SOLUÇõES DIGITAIS",
"cpf_voluntario": "999.999.999-99",
"quantidade_adesoes": 3,
"adesoes": [
{
"codigo_veiculo": "9",
"codigo_situacao": "999",
"descricao_situacao_veiculo": "INADIMPLENTE",
"data_adesao": "yyyy-mm-dd",
"codigo_associado" : "9",
"cpf_associado" : "9999999999"
},
{
"codigo_veiculo": "99",
"codigo_situacao": "999",
"descricao_situacao_veiculo": "INADIMPLENTE",
"data_adesao": "yyyy-mm-dd",
"codigo_associado" : "9",
"cpf_associado" : "9999999999"
},
{
"codigo_veiculo": "999",
"codigo_situacao": "9",
"descricao_situacao_veiculo": "ATIVO",
"data_adesao": "yyyy-mm-dd",
"codigo_associado" : "9",
"cpf_associado" : "9999999999"
}
]
}
```


---

## `POST listar/voluntario-por-data-cadastro` — Listar voluntário por data cadastro

Lista os voluntários cadastrados num determinado período de datas


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `filtrar_data` | String | sim | Caso não queira enviar as datas, enviar este parâmetro como "N", assim serão retornados os voluntários independente da data de cadastro deles |
| `data_cadastro_inicial` | String | sim | Data inicial do cadastro do voluntário |
| `data_cadastro_final` | String | sim | Data final do cadastro do voluntário |


**Exemplo Requisição:**
```json
{
"filtrar_data" : "Y",
"data_cadastro_inicial" : "dd/mm/yyyy",
"data_cadastro_final" : "dd/mm/yyyy"
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_voluntario": "99",
"nome": "HINOVA SOLUÇÕES DIGITAIS",
"cpf": "999999999999",
"telefone": "(99)9999-9999",
"celular": "(99)99999-99999",
"email": "hinova@hinova.com.br",
"logradouro": "RUA MANOEL ELIAS DE AGUIAR",
"numero": "245",
"complemento": "",
"bairro": "OURO PRETO",
"cidade": "BELO HORIZONTE",
"estado": "MG",
"data_cadastro" : yyyy-mm-dd,
"situacao": "ATIVO",
"formato_pagamento": "R$",
"valor_pagamento": "99.99",
"formato_pagamento_residual": "%",
"valor_pagamento_residual": "9.99",
"cooperativas": [
{
"codigo_cooperativa": "9",
"nome_cooperativa": "HINOVA"
}
]
}
```


---

## `GET listar/voluntario/:situacao` — Listar

Lista os voluntários que estão vinculados a cooperativas nas quais o usuário tem permissão. No array "cooperativas", cada índice dele representa o código da cooperativa, e o valor representa o nome da cooperativa


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação dos voluntários a serem retornados, se a situação for "todos", serão retornados todos os voluntários não excluídos, independente de estarem ativos ou inativos |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_voluntario": "9",
"nome": "HINOVA SOLUÇÕES DIGITAIS",
"cpf": "999999999999",
"cep": "99999999",
"codigo_classificacao": "9",
"telefone": "(99)9999-9999",
"celular": "(99)99999-9999",
"telefone_comercial": "(99)9999-9999",
"email": "hinova@hinova.com.br",
"logradouro": "MANOEL ELIAS AGUIAR",
"numero": "245",
"complemento": "",
"bairro": "OURO PRETO",
"cidade": "BELO HORIZONTE",
"estado": "MG",
"cep": "99999999",
"situacao": "ATIVO",
"formato_pagamento": "R$",
"valor_pagamento": "999.99",
"formato_pagamento_residual": "%",
"valor_pagamento_residual": "99.99",
"codigo_classificacao": "9",
"obs": "observação",
"cooperativas": [
{
"codigo_cooperativa": "9",
"nome_cooperativa": "HINOVA SOLUÇÕES DIGITAIS"
}
]
}
```


---
