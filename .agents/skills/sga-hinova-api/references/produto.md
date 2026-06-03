# Produto (10 endpoints)

Base URL: `https://api.hinova.com.br/api/sga/v2`. Todos os endpoints (exceto `/usuario/autenticar`) exigem header `Authorization: Bearer <token_usuario>`.

---

## `POST /veiculo/incluir/produto-adicional` — Cadastrar Prod. Adicional

Cadastra um produto adicional a um veículo


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_veiculo` | String | sim | Código do veículo ao qual o produto adicional será vinculado |
| `descricao` | String | sim | Descrição do produto adicional |
| `valor` | Number | sim | Valor do produto adicional |
| `formato` | String | sim | Formato do produto adicional. Pode ser "R$" ou "%" |
| `codigo_classificacao` | String | sim | Código da classificação do produto adicional. Opcional |
| `mes_referente` | String | sim | Mês referente inicial da cobrança do produto adicional. Formato "mm/yyyy" |
| `mes_referente_final` | String | sim | Mês referente final da cobrança do produto adicional. Formato "mm/yyyy" |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"codigo_produto_adicional": "9999"
}
```


---

## `POST /veiculo/listar-produto-adicional` — Listar Prod. Adicional

Lista os produtos adicionais vinculados a um veículo


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_veiculo` | Number | sim | Código do veículo |
| `data_cadastro_inicial` | String | sim | Data de cadastro inicial do produto adicional. Formato "dd/mm/yyyy" |
| `data_cadastro_final` | String | sim | Data de cadastro final produto adicional. Formato "dd/mm/yyyy" |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"codigo_veiculo": "9999",
"produtos_adicionais":[
{
"codigo_produto_adicional": "9",
"descricao": "PRODUTO ADICIONAL 9",
"valor": 99.99,
"formato": "R",
"mes_referente": "mm/yyyy",
"mes_referente_final": "mm/yyyy",
"situacao": "ATIVO"
},
{
"codigo_produto_adicional": "99",
"descricao": "PRODUTO ADICIONAL 99",
"valor": 999.99,
"formato": "R",
"mes_referente": "mm/yyyy",
"mes_referente_final": "mm/yyyy",
"situacao": "COBRADO"
}
]
}
```


---

## `GET grupoproduto/listar` — Listar Grupo Produto

Lista os grupos de produtos cadastrados no sistema


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_grupo": 9,
"produtos": [
{
"codigo_produto": 99,
"descricao_produto": "ASSISTÊNCIA 24 HORAS"
},
{
"codigo_produto": 9999,
"descricao_produto": "COBERTURA PARA 3°"
}
]
}
```


---

## `GET listar/classificacao-produto/:situacao` — Listar Classificação

Lista as classificações de produtos de acordo com a situação. A situação pode ser "ativo", "inativo" ou "todos"


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | Number | sim | Classificação do produto |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_classificacaoproduto": "9",
"descricao": "DESCRIÇÃO"
}
```


---

## `GET listar/grupo-produto/:situacao` — Listar grupo

Lista todos os grupos de produto de acordo com o parâmetro "situacao"


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | Number | sim | Define qual a situação dos grupos a serem retornados, se a situação for "todos", serão retornados todos os grupos não excluídos, independente de estarem ativos ou inativos |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_grupo": "9",
"descricao": "GRUPO",
"pre_contratado": "Y",
"respeitar_cooperativa_regional": "Y",
"situacao": "ATIVO"
}
```


---

## `GET listar/produto-por-situacao/:situacao` — Listar Por Situação

Lista todos os produtos que estão dentro da situação enviada respeitando as permissões de cooperativa e regional do usuário. Este método não usa os filtros específicos: Regional, Cooperativa, Tipo veículo, Valor Fipe e Cilindrada. Estes filtros são utilizados no método listar/produto


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | Number | sim | Situação do produto |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_produto": "9999",
"descricao_produto": "ASSISTÊNCIA 24 HORAS",
"descricao_produto_boleto": "ASSISTÊNCIA",
"tipo_veiculo": "9",
"descricao_tipo_veiculo" : "AUTOMÓVEL",
"valor_produto": "999,99",
"valor_fipe_inicial": 9,
"valor_fipe_final": 99999,
"padrao": "Y",
"formato_cobranca" : "R$",
"situacao" : "ATIVO"
}
```


---

## `GET listar/produto/:codigo_regional/:codigo_cooperativa/:codigo_tipo_veiculo/:valor_fipe/:cilindrada` — Listar

Lista produtos filtrando por regional, cooperativa, tipo veículo, valor Fipe ou cilindrada e respeitando as permissões de cooperativa e regional do usuário


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_regional` | Number | sim | Código da regional na qual os produtos estão vinculados |
| `codigo_cooperativa` | Number | sim | Código da cooperativa na qual os produtos estão vinculados |
| `codigo_tipo_veiculo` | Number | sim | Código do tipo veículo |
| `valor_fipe` | String | sim | Valor protegido do veículo. Deve ser enviado com valor decimal Ex.: 100,00. Pode ser enviado 0 caso o veículo seja baseado em cilindrada. |
| `cilindrada` | String | sim | Cilindrada do veículo. Pode ser enviado 0 quando o veículo é baseado em valor fipe |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_produto": "9999",
"decricao_produto": "CARRO RESERVA",
"descricao_produto_boleto": "CARRO RESERVA",
"valor_produto": "99.999",
"valor_fipe_inicial": 9,
"valor_fipe_final": 999999,
"padrao": "N",
"compulsorio": "N",
"formato_cobranca": "%",
"base_cobranca": "FIPE",
"codigo_tipo_veiculo": "9",
"descricao_tipo_veiculo": "AUTOMÓVEL",
"regionais": [
{
"codigo_regional": "9",
"nome_regional": "HINOVA SOLUÇÕES DIGITAIS "
}
]
}
```


---

## `GET produto-vinculado-veiculo/listar/:codigoOuPlaca` — Listar Produtos Veículo

Lista todos os produtos de um determinado veículo


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigoOuPlaca` | Number | sim | Código ou placa do veículo a ser consultado |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_veiculo": "617",
"valor_fixo": 58.96,
"valor_total_produtos_RS": 213.46,
"valor_total_produtos_%": 173.92,
"produtos" : [
{
"codigo_produto": "999",
"descricao": "ASSISTÊNCIA 24 HORAS",
"formato_cobranca": "R$",
"valor": "9.99",
"situacao": "ATIVO"
},
{
"codigo_produto": "99",
"descricao": "COBERTURA PARA 3°",
"formato_cobranca": "%",
"valor": "99.99",
"situacao": "INATIVO"
}
],
"produtos_adicionais": [
{
"codigo_produto_adicional": "9999",
"descricao": "DESCONTO",
"valor": -99.99,
"formato": "R$",
"mes_referente": "yyyy-mm",
"mes_referente_final": "yyyy-mm",
"situacao": "A"
}
]
}
```


---

## `GET produto/buscar/:codigo_produto` — Buscar

Busca o produto pelo código, respeitando as permissões do usuário.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_produto` | Number | sim | Código do produto à ser pesquisado. |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_produto": "999",
"descricao": "ASSISTENCIA 24 HORAS",
"descricao_boleto": "ASSISTENCIA 24 HORAS",
"codigo_fornecedor": "99",
"nome_fornecedor": "FORNECEDOR",
"codigo_classificacaoproduto": "35",
"situacao": "ATIVO"
}
```


---

## `POST veiculo/vincular-remover/produto` — Vincular ou remover produto

Vincula ou exclui produtos a um veículo


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_veiculo` | Number | sim | Código do veículo |
| `produtos_adicionar` | Array | sim | Array contendo os códigos dos produtos a serem inseridos |
| `produtos_remover` | Array | sim | Array contendo os códigos dos produtos a serem removidos |


**Exemplo Requisição:**
```json
{
"codigo_veiculo" : 999,
"produtos_adicionar" : [
"1",
"2"
],
"produtos_remover" : [
"3"	
]
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
{
"codigo_produto": 1,
"mensagem": "Produto adicionado"
},
{
"codigo_produto": 2,
"mensagem": "Produto adicionado"
},
{
"codigo_produto": 3
"mensagem": "Produto removido"
}
]
```


---
