# Associado (20 endpoints)

Base URL: `https://api.hinova.com.br/api/sga/v2`. Todos os endpoints (exceto `/usuario/autenticar`) exigem header `Authorization: Bearer <token_usuario>`.

---

## `POST /alterar/associado` — Alterar


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_associado` | Number | sim | Código do associado a ser alterado. Opcional caso esteja enviando o CPF do associado |
| `nome` | String | não | Nome do associado. |
| `cpf` | String | não | CPF ou CNPJ válido do associado. Marcara: 999.999.999-99, 99.999.999/9999-99 ou somente números. Opcional caso esteja enviando o codigo_associado. Para alterar o CPF do associado é preciso enviar o código do associado também. |
| `rg` | String | não | Registro geral do associado. |
| `data_nascimento` | String | não | Data de nascimento do associado. Mascara: 99/99/9999. |
| `telefone` | String | não | Número de telefone do associado. Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999. |
| `celular` | String | não | Número de celular do associado. . Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999. |
| `email` | String | não | e-Mail do associado. . |
| `logradouro` | String | não | Logradouro residêncial do associado. |
| `numero` | String | não | Número residêncial do associado. |
| `complemento` | String | não | Complemento residêncial do associado. |
| `bairro` | String | não | Bairro residêncial do associado. |
| `cidade` | String | não | Cidade residêncial do associado. |
| `estado` | String | não | Estado residêncial do associado. Informar DESCRIÇÃO ou SIGLA. |
| `cep` | String | não | Cep residêncial do associado. Mascara: 99999-999 ou 99.999-999 ou somente números. |
| `codigo_profissao` | Number | não | Código profissão. |
| `codigo_regional` | Number | não | Código regional. |
| `codigo_cooperativa` | Number | não | Código da cooperativa. |
| `codigo_conta` | Number | não | Código do banco. Obrigatório caso tenha mais de uma conta bancária cadastrada para a regional. |
| `dia_vencimento` | Number | não | Dia do mês no qual o boleto irá vencer. |
| `codigo_externo` | Number | não | Código externo do associado. |
| `sexo` | String | não | Sexo do associado. |
| `boleto_fisico` | String | não | Boleto físico. Mascara: Y ou N |
| `data_vencimento_habilitacao` | String | não | Data de Vencimento da habilitação do associado. . Mascara: 99/99/9999 |
| `data_primeira_habilitacao` | String | não | Data de emissão da primeira habilitação do associado. . Mascara: 99/99/9999 |
| `categoria_cnh` | String | não | Categoria da CNH do associado. |
| `codigo_como_conheceu` | Number | não | Código da mídia pela qual o associado conheceu a associação. |
| `cartao` | Array | não | Array contendo os atributos do cartão do associado. Contém os atributos: codigo_cartao(código do cartão do associado), hash(hash do cartão), numero_final_cartao(últimos 3 dígitos do cartão) |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `mensagem` | String | sim | Mensagem de retorno |
| `codigo_associado` | String | sim | Código do associado inserido na base de dados |


**Exemplo Requisição:**
```json
{
"nome":	"Hinova Soluções Digitais",
"codigo_associado":	"999",
"data_nascimento":	"dd/mm/yyyy",
"telefone":	"(99) 99999-9999",
"celular": "(99) 99999-9999",
"email": "teste@hinova.com.br",
"logradouro": "Rua Manoel Elias de Aguiar",
"numero": "245",
"complemento": "Comercial",
"bairro": "Ouro Preto",
"cidade": "Belo Horizonte",
"estado": "Minas Gerais",
"cep": "31.330-520",
"boleto_fisico": "Y",
"codigo_regional": "9",
"codigo_cooperativa": "9",
"data_vencimento_habilitacao": "dd/mm/yyyy",
"data_primeira_habilitacao": "dd/mm/yyyy",
"categoria_cnh": "A"
"mes_referente": "11/2019",
"valor_fixo": "99,99",
"codigo_como_conheceu" :9,
"cartao": {
"hash": "9999999999999",
"numero_final_cartao": "999",
"codigo_cartao": "9"
}
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"codigo_associado":	999
}
```


---

## `POST /associado/cadastrar` — Cadastrar


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nome` | String | sim | Nome do associado. |
| `cpf` | String | sim | CPF ou CNPJ válido do associado. Marcara: 999.999.999-99, 99.999.999/9999-99 ou somente números |
| `rg` | String | sim | Registro geral do associado |
| `data_nascimento` | String | sim | Data de nascimento do associado. Mascara: dd/mm/yyyy |
| `ddd` | String | sim | DDD do telefone fixo do associado |
| `telefone` | String | sim | Número de telefone do associado. Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999 |
| `logradouro` | String | sim | Logradouro residêncial do associado |
| `numero` | String | sim | Número residêncial do associado |
| `bairro` | String | sim | Bairro residêncial do associado |
| `cidade` | String | sim | Cidade residêncial do associado |
| `estado` | String | sim | Estado residêncial do associado. Informar DESCRIÇÃO ou SIGLA |
| `cep` | String | sim | Cep residêncial do associado. Mascara: 99999-999 ou 99.999-999 ou somente números |
| `codigo_conta` | Number | sim | Código do banco. Obrigatório caso tenha mais de uma conta bancária cadastrada para a regional |
| `mes_referente` | String | sim | Mês referente |
| `sexo` | String | sim | Sexo do associado. Valores aceitos M ou F. |
| `complemento` | String | não | Complemento residêncial do associado |
| `orgao_expedidor_rg` | String | não | Órgão expedidor do RG. |
| `data_expedicao_rg` | String | não | Data da expedição do RG. . Mascara: dd/mm/yyyy |
| `ddd_celular` | String | não | DDD do celular do associado. |
| `ddd_comercial` | String | não | DDD do telefone comercial do associado. |
| `telefone_comercial` | String | não | Telefone comercial do associado. |
| `Celular` | String | não | Número de celular do associado. . Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999 |
| `email` | String | não | e-Mail do associado. |
| `email_auxiliar` | String | não | e-mail auxiliar do associado. |
| `codigo_profissao` | Number | não | Código profissão. |
| `codigo_regional` | Number | não | Código regional. |
| `codigo_cooperativa` | Number | não | Código da cooperativa. |
| `dia_vencimento` | Number | não | Dia do mês no qual o boleto irá vencer. |
| `codigo_externo` | Number | não | Código externo do associado. |
| `data_vencimento_habilitacao` | String | não | Data de Vencimento da habilitação do associado. Mascara: dd/mm/yyyy |
| `data_primeira_habilitacao` | String | não | Data de emissão da primeira habilitação do associado. Mascara: dd/mm/yyyy |
| `categoria_cnh` | String | não | Categoria da CNH do associado. |
| `numero_cnh` | String | não | Número da CNH do associado. |
| `data_contrato` | String | não | Data do contrato do associado. |
| `valor_fixo` | Number | não | Valor fixo mensal |
| `codigo_voluntario` | Number | não | Código do voluntário responsável pela adesão. |
| `qtde_parcela_carne` | Number | não | Quantidade de parcelas do carnê. |
| `codigo_como_conheceu` | Number | não | Código da mídia pela qual o associado conheceu a associação. |
| `observacao` | String | não | Observação do associado. |
| `beneficios` | Array | não | Array contendo os códigos dos benefícios a serem vinculados ao associado. |
| `cartao` | Array | não | Array contendo os dados do cartão de crédito do associado. |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `mensagem` | String | sim | Mensagem de retorno |
| `codigo_associado` | String | sim | Código do associado inserido na base de dados |


**Exemplo Requisição:**
```json
{
"nome" : "Hinova Soluções Digitais",
"cpf" :	"99.999.999/9999-99 ou 999.999.999-99",
"rg" : "999999",
"data_nascimento" :	"dd/mm/yyyy",
"telefone" : "(99) 99999-9999",
"celular" :	"(99) 99999-9999",
"email" : "teste@hinova.com.br",
"logradouro" : "Rua Manoel Elias de Aguiar",
"numero" : "245",
"complemento" :	"Comercial",
"bairro" : "Ouro Preto",
"cidade" : "Belo Horizonte",
"estado" : "Minas Gerais",
"cep" :	"31.330-520",
"codigo_profissao" : 9,
"codigo_regional" :	9,
"codigo_cooperativa": 9,
"codigo_conta" : 99,
"dia_vencimento" : 99,
"codigo_externo" : 9,
"sexo" : "M",
"data_vencimento_habilitacao" : "dd/mm/yyyy",
"data_primeira_habilitacao" : "dd/mm/yyyy",
"categoria_cnh" : "A",
"numero_cnh" : "999999999",
"data_contrato" : "dd/mm/yyyy",
"valor_fixo" : "99,99",
"mes_referente" : "mm/yyyy",
"qtde_parcela_carne" : 9,
"codigo_como_conheceu" : 9,
"beneficios" : [
{
"codigo_beneficio" : 9
},
{
"codigo_beneficio" : 99	
}
]
"cartao" : {
"numero_final_cartao" : "999",
"codigo_bandeira_cartao" : 999
"hash" : "9999999999",
"validade" : "mm/yyyy"
}
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem"			: 	"OK",
"codigo_associado"	:	999999,
"beneficios": [
{
"codigo_beneficio": "9",
"situacao": "Benefício adicionado ao associado"
},
{
"codigo_beneficio": "99",
"situacao": "Benefício adicionado ao associado"
}
]
}
```


---

## `GET /associado/novos-contratos/listar` — Listar a quantidade de contratos

Lista a quantidade de contrato realizados no dia atual


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Exemplo Retorno:**
```json
{
"quantidade_contratos": "9",
"codigo_associados": "99,999"
}
```


---

## `GET associado-ativo-inativo/listar` — Quant. Associado Ativo/Inativo

Retorna a quantidade de associados ativos e inativos no sistema


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Exemplo Retorno:**
```json
{
"mensagem": "OK",
"associados_ativos": "9999",
"associados_inativos": "99"
}
```


---

## `GET associado/alterar-situacao-para/:codigo_situacao/:codigo_associado` — Alterar situação

Altera a Situação do associado de acordo com o código do associado


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_situacao` | Number | sim | Define qual a nova Situação do associado |
| `codigo_associado` | Number | sim | Código do associado o qual se deseja mudar a situação |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "Alterado",
"codigo_associado": 999
}
```


---

## `GET associado/aniversariante` — Listar Aniversariante Dia

Lista todos os associados/beneficiários aniversariantes do dia


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
{
"codigo_associado": "99",
"codigo_beneficiario": "99",
"data_nascimento": "yyyy-mm-dd",
"nome": "NOME",
"telefone": "(99)999999999",
"telefone_celular": "(99)999999999",
"email": "email@email.com"
}
}
```


---

## `GET associado/buscar-por-cpf-senha/:cpf/:senha` — Buscar Por CPF-CNPJ e Senha

Busca associado pelo CPF/CNPJ e pela senha


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{	
"codigo_associado": "999",
"nome": "HINOVA SOLUÇÕES DIGITAIS",
"cpf": "9999999999",
"telefone_fixo": "(99)9999-99999",
"celular": "(99)99999-9999",
"logradouro": "RUA MANOEL ELIAS DE AGUIAR",
"numero": "245",
"bairro": "OURO PRETO",
"cidade": "BELO HORIZONTE",
"estado": "MG",
"cep": "31330-520",
"email": "hinova@hinova.com.br",
"veiculos": [
{
"codigo_veiculo": 999,
"placa": "AAA-111",
"chassi": "999999999999",
"valor_fixo" : 99.99,
"codigo_situacao": "9",
"valor_fipe": 99999999,
"descricao_situacao": "ATIVO",
"descricao_modelo": "MODELO VEICULO",
"codigo_modelo": "99999",
"codigo_veiculo_indicador": 99,
"placa_veiculo_indicador": "AAA-9999",
"codigo_associado_indicador": 9,
"cpf_associado_indicador": 99999999,
"nome_associado_indicador": "HINOVA SOLUÇÕES DIGITAIS"
}
]
}
```


---

## `GET associado/buscar/:cpfOuCodigo/:buscar_por` — Buscar

Busca associado pelo CPF ou pelo código


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `cpfOuCodigo` | String | sim | CPF ou código do associado a ser pesquisado |
| `buscar_por` | String | sim | Define se o parâmetro cpfOuCodigo é o CPF ou o código do associado |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{	
"codigo_associado": "99",
"codigo_associado_beneficiario": "999",
"nome": "HINOVA SOLUÇÕES DIGITAIS",
"sexo": "M",
"data_nascimento": "yyyy-mm-dd",
"rg": "MG 99999999",
"orgao_expedidor_rg": "SSPMG",
"data_expedicao_rg": "yyy-mm-dd",
"cnh": "999999999999",
"categoria_cnh": "A",
"data_vencimento_habilitacao": "yyyy-mm-dd",
"cpf": "999.999.999-99",
"telefone_fixo": "(99)9999-9999",
"telefone_celular": "(99)99999-9999",
"telefone_celular_aux": "(99)99999-9999",
"telefone_comercial": "(99)9999-9999",
"email": "hinova@hinova.com.br",
"email_auxiliar": "hinova.aux@hinova.com",
"cep": "99999-99",
"logradouro": "RUA MANOEL ELIAS DE AGUIAR",
"numero": "245",
"complemento": "COMERCIAL",
"bairro": "OURO PRETO",
"cidade": "BELO HORIZONTE",
"estado": "MG",
"codigo_regional": "9",
"codigo_cooperativa": "9",
"codigo_externo": "AAA999",
"codigo_situacao": "9",
"codigo_voluntario": "9",
"descricao_situacao": "ATIVO",
"veiculos": [
{
"codigo_veiculo": "999",
"placa": "AAA-111",
"chassi": "999999999999",
"valor_fixo" : 99.99
}
]
}
```


---

## `GET associado/cartao/listar/:codigoOuCpf` — Buscar Cartões associado

Lista os cartões de crédito de um determinado associado pelo CPF ou código do associado


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
{
"codigo_cartao": "9999",
"numero_final_cartao": "99",
"validade": "mm/yyyy",
"situacao": "A"
},
{
"codigo_cartao": "99999",
"numero_final_cartao": "999",
"validade": "mm/yyyy",
"situacao": "E"
}
]
```


---

## `GET associado/gerar-url-cadastro-cartao/:id_associado/:cpf` — Gerar URL Cadastro Cartão

Gera URL que é utilizada para realizar o cadastramento de cartão de crédito para cobranças recorrentes


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{	
"codigo_associado": 9,
"nome": "HINOVA SOLUÇÕES DIGITAIS",
"url_cadastro_cartao" : "https://"
}
```


---

## `POST indicacao-externa/cadastrar` — Cadastrar Indicação Externa

Cadastra uma indicação externa


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nome` | String | sim | Nome da indicação. |
| `cpf` | String | não | CPF da indicação. |
| `ddd_telefone` | String | não | DDD do telefone. |
| `telefone` | String | não | Telefone. |
| `codigo_associado_indicador` | Number | não | Código do associado que fez a indicação. |
| `codigo_veiculo_indicador` | Number | não | Código do veículo do associado que fez a indicação. |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"codigo_indicacaoexterna": "99"
}
```


---

## `GET indicacao-externa/listar/:situacao` — Listar Indicação Ext.

Lista as indicações externas cadastradas no sistema


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define se as indicações a serem retornadas devem estar ativas, inativas ou seleciona todas independente da situação dela. |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_indicacaoexterna": "9",
"nome": "HINOVA SOLUÇÕES DIGITAIS",
"cpf": "9999999999",
"situacao": "ATIVO"
}
```


---

## `POST listar/alteracao-associados/` — Listar Alterações de Associados

Lista as alterações de associados em um intervalo de até 7 dias


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `data_inicial` | String | sim | Data inicial da pesquisa. Formato dd/mm/yyyy |
| `data_final` | String | sim | Data final da pesquisa. Formato dd/mm/yyyy |
| `ultima_alteracao` | String | sim | Define se será exibida apenas a última alteração de cada associado . Formato "Y" ou "N". Opcional |
| `campos` | Array | sim | Array contendo o nome dos campos do associado que devem ser retornados |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
{
"codigo_associado": "840",
"cpf_associado": "999999999999",
"nome_associado": "HINOVA",
"nome_campo_tabela": "codigo_situacao",
"valor_anterior": "9",
"valor_posterior": "999",
"data_alteracao": "yyyy-mm-dd"
"codigo_usuario_alteracao": "9",
"nome_usuario_alteracao": "HINOVA SOLUçõES DIGITAIS"
},
{
"codigo_associado": "840",
"cpf_associado": "99999999",
"nome_associado": "HINOVA",
"nome_campo_tabela": "cpf",
"valor_anterior": "9999",
"valor_posterior": "99999999",
"data_alteracao": "yyyy-mm-dd",
"codigo_usuario_alteracao": "9",
"nome_usuario_alteracao": "HINOVA SOLUçõES DIGITAIS"
}
]
```


---

## `POST listar/associado/` — Listar

Lista os associados de acordo com a situação especificada


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_situacao` | Number | sim | Define qual a situação dos associados a serem listados. O codigo_situacao é obrigatório |
| `inicio_paginacao` | Number | sim | Define qual o início da paginação. Se não for enviado, o início da paginação será 0. |
| `fim_paginacao` | Number | sim | Define a quantidade de registros exibidos por página. Se não for enviado, a quantidade de registros por página será de 5000. |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"total_associados": "999999",
"mostrando ": "9",
"numero_paginas": 99,
"associados": [
{
"codigo_associado": "999",
"nome": "HINOVA SOLUÇÕES DIGITAIS",
"sexo": "M",
"tipo_pessoa": "FÍSICA",
"data_nascimento": "1990-01-01",
"rg_associado": "9999999999",
"orgao_expedidor_rg": "MG",
"data_expedicao_rg": "2000-01-01",
"cnh": "9999999999999",
"categoria_cnh": "B",
"data_vencimento_habilitacao": "2036-01-01",
"cpf": "999999999999999",
"ddd": "99",
"telefone": "9999-9999",
"ddd_celular": "99",
"telefone_celular": "99999-9999",
"ddd_celular_aux": "99",
"telefone_celular_aux": "9999-9999",
"ddd_comercial": "99",
"telefone_comercial": "9999-9999",
"email": "hinova@hotmail.com",
"email_auxiliar": "hinova@hotmail.com",
"cep": "99999-999",
"logradouro": "LOGRADOURO",
"numero": "887",
"complemento": "COMPLEMENTO",
"bairro": "BAIRRO",
"cidade": "CIDADE",
"estado": "MG",
"data_cadastro_associado": "2019-01-01",
"data_contrato_associado": "2019-01-01",
"hora_contrato_associado": "00:00:00"
}
]
}
```


---

## `GET listar/estadocivil/:situacao` — Listar Estados Civis

Lista os estado civis disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória


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

## `GET listar/parentesco/:situacao` — Listar Parentescos

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
"codigo_parentesco": 9,
"descricao_parentesco": "MÃE"
}
```


---

## `GET listar/profissao/:situacao` — Listar Profissões

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
   	"codigo_profissao": 9,
"descricao_profissao": "DESENVOLVEDOR"
}
```


---

## `GET listar/situacao/:situacao` — Listar Situação

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

## `GET listar/vencimento/:situacao` — Listar Vencimentos

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
"codigo_vencimento": 9,
"dia_vencimento": 99,
"situacao": "ATIVO"
}
```


---

## `GET midia/listar/:situacao` — Listar Mídia

Lista as mídias(como conheceu) cadastradas no sistema


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define se as mídias a serem retornadas devem estar ativas, inativas ou seleciona todas independente da situação dela. |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_midia": "9",
"descricao": "TELEVISÃO",
"situacao": "ATIVO"
}
```


---
