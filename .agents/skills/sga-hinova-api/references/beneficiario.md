# Beneficiario (11 endpoints)

Base URL: `https://api.hinova.com.br/api/sga/v2`. Todos os endpoints (exceto `/usuario/autenticar`) exigem header `Authorization: Bearer <token_usuario>`.

---

## `POST /alterar/beneficiario` — Alterar


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_beneficiario` | Number | sim | Código do beneficiário a ser alterado. Opcional caso esteja enviando o CPF do beneficiário |
| `cpf` | String | sim | CPF ou CNPJ válido do beneficiário. Marcara: 999.999.999-99, 99.999.999/9999-99 ou somente números. Opcional caso esteja enviando o código do beneficiário. Para alterar o CPF do beneficiário é preciso enviar o código do beneficiário |
| `nome` | String | não | Nome do beneficiário. |
| `rg` | String | não | Registro geral do beneficiário. |
| `data_nascimento` | Date | não | Data de nascimento do beneficiário. Mascara: dd/mm/yyyy. |
| `codigo_parentesco` | Number | não | Código do parentesco do beneficiário. |
| `telefone` | String | não | Número de telefone do beneficiário. Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999. |
| `celular` | String | não | Número de celular do beneficiário. . Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999 |
| `email` | String | não | e-Mail do beneficiário. |
| `logradouro` | String | não | Logradouro residêncial do beneficiário. |
| `numero` | String | não | Número residêncial do beneficiário. |
| `complemento` | String | não | Complemento residêncial do beneficiário. |
| `bairro` | String | não | Bairro residêncial do beneficiário. |
| `cidade` | String | não | Cidade residêncial do beneficiário. |
| `estado` | String | não | Estado residêncial do beneficiário. Informar DESCRIÇÃO ou SIGLA . |
| `cep` | String | não | Cep residêncial do beneficiário. Mascara: 99999-999 ou 99.999-999 ou somente números. |
| `codigo_profissao` | Number | não | Código profissão. |
| `codigo_cooperativa` | Number | não | Código da cooperativa. |
| `codigo_conta` | Number | não | Código do banco. |
| `dia_vencimento` | Number | não | Dia do mês no qual o boleto irá vencer. |
| `codigo_associado` | Number | não | Código do associado ao qual o beneficiário está vinculado. |
| `codigo_externo` | Number | não | Código externo do beneficiário. |
| `sexo` | String | não | Sexo do beneficiário. |
| `categoria_cnh` | String | não | Categoria da CNH do beneficiário. |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo` | Number | sim | Código de retorno. Ex: 200, 203, 401 etc |
| `mensagem` | String | sim | Mensagem de retorno |
| `codigo_beneficiario` | String | sim | Código do beneficiário inserido na base de dados |


**Exemplo Requisição:**
```json
    	{
    		"nome"				: "Hinova Soluções Digitais",
     		"codigo_beneficiario" : 999,
      	"telefone"			: "(99) 99999-9999",
      	"celular"			: "(99) 99999-9999",
      	"email"				: "teste@hinova.com.br",
       	"logradouro"		: "Rua Manoel Elias de Aguiar",
        	"numero"			: "245",
         	"complemento"		: "Comercial",
          "bairro"			: "Ouro Preto",
          "cidade"			: "Belo Horizonte",
          "estado"			: "Minas Gerais",
          "cep"				: "31.330-520",
"dia_vencimento"	: 99
      }
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
  	"codigo"				: 	"200",
   	"mensagem"				: 	"OK",
   	"codigo_beneficiario"	:	999
}
```


---

## `POST /beneficiario/cadastrar` — Cadastrar


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nome` | String | sim | Nome do beneficiário |
| `cpf` | String | sim | CPF ou CNPJ válido do beneficiário. Mascara: 999.999.999-99, 99.999.999/9999-99 ou somente números |
| `rg` | String | sim | Registro geral do beneficiário |
| `data_nascimento` | Date | sim | Data de nascimento do beneficiário. Mascara: 99/99/9999 |
| `telefone` | String | sim | Número de telefone do beneficiário. Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999 |
| `logradouro` | String | sim | Logradouro residêncial do beneficiário |
| `numero` | String | sim | Número residêncial do beneficiário |
| `complemento` | String | sim | Complemento residêncial do beneficiário |
| `bairro` | String | sim | Bairro residêncial do beneficiário |
| `cidade` | String | sim | Cidade residêncial do beneficiário |
| `estado` | String | sim | Estado residêncial do beneficiário. Informar DESCRIÇÃO ou SIGLA |
| `cep` | String | sim | Cep residêncial do beneficiário. Mascara: 99999-999 ou 99.999-999 ou somente números |
| `codigo_conta` | Number | sim | Código do banco. Obrigatório caso tenha mais de uma conta bancária cadastrada para a regional |
| `codigo_associado` | Number | sim | Código do associado ao qual o beneficiário está vinculado. Obrigatório |
| `codigo_parentesco` | Number | não | Código do parentesco do beneficiário. |
| `celular` | String | não | Número de celular do beneficiário. Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999 |
| `email` | String | não | e-Mail do beneficiário. |
| `codigo_profissao` | Number | não | Código profissão. |
| `codigo_cooperativa` | Number | não | Código da cooperativa. |
| `dia_vencimento` | Number | não | Dia do mês no qual o boleto irá vencer. |
| `codigo_externo` | Number | não | Código externo do beneficiário. |
| `sexo` | String | não | Sexo do beneficiário. |
| `categoria_cnh` | String | não | Categoria da CNH do beneficiário. |
| `qtde_parcela_carne` | Number | não | Quantidade de parcelas do carnê. |
| `valor_fixo` | Number | não | Valor Fixo. |
| `gerar_cobranca` | String | não | Especifica se deve ser gerada cobrança para o beneficiário sendo cadastrado. Deve ser enviada no formato "Y"(sim) ou "N"(não) |
| `beneficios` | Array | não | Array contendo os códigos dos benefícios a serem vinculados ao beneficiário. |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo` | Number | sim | Código de retorno. Ex: 200, 203, 401 etc |
| `mensagem` | String | sim | Mensagem de retorno |
| `codigo_beneficiario` | String | sim | Código do beneficiário inserido na base de dados |


**Exemplo Requisição:**
```json
    	{
    		"nome"				: "Hinova Soluções Digitais",
     		"cpf"				: "99.999.999/9999-99 ou 999.999.999-99",
       	"rg"				: "999999",
      	"data_nascimento"	: "99/99/9999",
"codigo_parentesco"	: "9",
      	"telefone"			: "(99) 99999-9999",
      	"celular"			: "(99) 99999-9999",
      	"email"				: "teste@hinova.com.br",
       	"logradouro"		: "Rua Manoel Elias de Aguiar",
        	"numero"			: "245",
         	"complemento"		: "Comercial",
          "bairro"			: "Ouro Preto",
          "cidade"			: "Belo Horizonte",
          "estado"			: "Minas Gerais",
          "cep"				: "31.330-520",
          "codigo_profissao"	: "9",
          "codigo_cooperativa": "9",
"codigo_conta"		: "99",
"dia_vencimento"	: "99",
"codigo_associado"	: "9999",
"codigo_externo"	: "9",
"sexo"				: "M",
"categoria_cnh" 	: "A",
"qtde_parcela_carne": "9",
"valor_fixo"		: "99,99",
"gerar_cobranca" 	: "Y",
"beneficios" : [
{
"codigo_beneficio" : "9"
},
{
"codigo_beneficio" : "99"	
}
  		]
      }
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo": "200",
"mensagem": "OK",
"codigo_beneficiario": 999999,
"beneficos": [
{
"codigo_beneficio": "9",
"situacao": "Benefício adicionado ao beneficiário"
},
{
"codigo_beneficio": "99",
"situacao": "Benefício adicionado ao beneficiário"
}
]
}
```


---

## `GET alterar/beneficiario-para-associado/:codigo_ou_cpf` — Alterar para associado

Transforma um beneficiário em um associado, mantendo todos os dados do beneficiário já cadastrados


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_ou_cpf` | String | sim | Código ou CPF do beneficiário a ser transformado em associado |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"codigo_associado": "999"
}
```


---

## `POST listar/beneficiario` — Listar

Lista os beneficiários de acordo com a situação especificada


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_situacao` | String | sim | Define qual a situação dos beneficiários a serem listados. O codigo_situacao é obrigatório |
| `inicio_paginacao` | Number | sim | Define qual o início da paginação. Se não for enviado, o início da paginação será 0. |
| `fim_paginacao` | Number | sim | Define a quantidade de registros exibidos por página. Se não for enviado, a quantidade de registros por página será de 5000. |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"total_beneficiario": "37",
"mostrando ": "1",
"numero_paginas": 37,
"pagina_corrente": 35,
"benficiarios": [
{
"codigo_beneficiario": "999",
"codigo_associado": "99",
"nome": "HINOVA SOLUÇÕES DIGITAIS",
"rg_beneficiario": "99999999",
"data_expedicao_rg": "yyyy-mm-dd",
"orgao_expedidor_rg": "MG",
"cpf": "99999999",
"cpf_associado": "9999999999",
"data_nascimento": "yyyy-mm-ddT00:00:00-0300",
"sexo": "M",
"nome_mae": "PAI",
"nome_mae": "MÃE",
"cnh": "99999999",
"categoria_cnh": "A",
"logradouro": "RUA MANOEL ELIAS DE AGUIAR",
"numero": "9",
"complemento": "99",
"bairro": "OURO PRETO",
"cidade": "BELO HORIZONTE",
"estado": "SC",
"cep": "99999-999",
"telefone": "999999999",
"ddd": 99,
"telefone_celular": "99",
"ddd_celular": 99999999,
"telefone_celular_aux": "99999999",
"ddd_celular_aux": 99,
"telefone_comercial": "999999999",
"ddd_comercial": 99,
"email": "Hinova@hinova.com.br",
"email_auxiliar": "hinova@aux.com.br",
"data_cadastro_beneficiario": "yyyy-mm-dd",
"data_contrato_beneficiario": "yyyy-mm-dd",
"hora_contrato_beneficiario": "99:99:99",
"codigo_situacao": "9",
"descricao_situacao": "ATIVO"
}
]
}
```


---

## `GET listar/beneficio-beneficiario/:codigo_beneficiario` — Listar Benefícios Vinculados

Lista os benefícios vinculados a um certo beneficiário


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_beneficiario` | Number | sim | Código do beneficiário a ser consultado |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_beneficiario": "999",
"nome": "HINOVA SOLUÇÕES DIGITAIS",
"beneficios": [
{
"codigo_beneficio": "9",
"descricao": "BENEFICIO 1"
},
{
"codigo_beneficio": "99",
"descricao": "BENEFICIO 2"
}
]
}
```


---

## `GET listar/conta/:situacao` — Listar contas bancárias

Lista as contas as quais o usuário tem permissão de acesso


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação das contas a serem retornadas, se a situação for "todos", serão retornadas todas as contas, independente de estarem ativas ou inativas |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_conta" : "9",
"codigo_agencia": "99",
"codigo_banco":	"999",
"descricao_banco": "HINOVA BANK",
"situacao":	"ATIVO"
}
```


---

## `GET listar/estadocivil/:situacao` — Listar Estado Civil

Lista os estados civis disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação dos estado civis a serem retornados, se a situação for "todos", serão retornados todos os estado civis não excluídos, independente de estarem ativos ou inativos |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_estadocivil": "9",
"descricao_estadocivil": "Solteiro(a)"
}
```


---

## `GET listar/parentesco/:situacao` — Listar parentesco

Lista os parentescos disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação dos parentescos a serem retornados, se a situação for "todos", serão retornados todos os parentescos não excluídos, independente de estarem ativos ou inativos |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_parentesco": "9",
"descricao_parentesco": "Mãe"
}
```


---

## `GET listar/profissao/:situacao` — Listar profissao

Lista as profissões disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação das profissões a serem retornadas, se a situação for "todos", serão retornadas todas as profissões não excluídas, independente de estarem ativas ou inativas |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_profissao" : "9",
"descricao_profissao": "PROGRAMADOR"
}
```


---

## `GET listar/situacao/:situacao` — Listar situacao

Lista as situações cadastrada no sistema (Ativo, Pendente, Excluído, etc). Estas situações são utilizadas para ASSOCIADO, VEICULO e BENEFICIÁRIO


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define se as situações a serem retornadas devem estar ativas, inativas ou seleciona todas independente da situação dela. |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_situacao": 1,
"descricao_situacao": "ATIVO",
"situacao": "ATIVO"
}
```


---

## `GET listar/vencimento/:situacao` — Listar vencimento

Lista os vencimentos disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação dos vencimentos a serem retornados, se a situação for "todos", serão retornados todos os vencimentos não excluídos, independente de estarem ativos ou inativos |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_vencimento": "9",
"dia_vencimento": "10",
"situacao": "ATIVO"
}
```


---
