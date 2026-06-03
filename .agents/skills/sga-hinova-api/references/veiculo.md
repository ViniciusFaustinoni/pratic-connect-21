# Veiculo (30 endpoints)

Base URL: `https://api.hinova.com.br/api/sga/v2`. Todos os endpoints (exceto `/usuario/autenticar`) exigem header `Authorization: Bearer <token_usuario>`.

---

## `POST /alterar/veiculo` — Alterar


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_veiculo` | Number | sim | Código do veículo que será alterado. É o único campo obrigatório |
| `codigo_associado` | Number | não | Código do associado para vinculo ao veículo. |
| `codigo_cooperativa` | Number | não | Código da cooperativa. Será selecionado de acordo com a permissão do usuário. |
| `codigo_voluntario` | Number | não | Código do voluntário. Será selecionado de acordo com a cooperativa. |
| `ano_fabricacao` | Number | não | Ano fabricação do veículo. Mascara: 9999. |
| `ano_modelo` | Number | não | Ano modelo do veículo. Mascara: 9999. |
| `modelo` | String | não | Modelo do veículo. |
| `placa` | String | não | Placa do veículo. Caso o veículo seja ZERO KM não necessário enviar ou enviar vazio. |
| `chassi` | String | não | Chassi do veículo. |
| `renavam` | String | não | Renavam do veículo. |
| `numero_motor` | String | não | Número motor do veículo. |
| `kilometragem` | Number | não | Kilometagem do veículo. |
| `cilindrada` | Number | não | Cilindrada do veículo. Utilizado quando o item é motocicleta. |
| `quantidade_portas` | Number | não | Quantidade de portas do veículo. |
| `cambio` | String | não | Tipo do câmbio do veículo. Ele pode ser: A(automático), M(manual) ou 0(não informado). |
| `codigo_fipe` | String | não | Código fipe do veículo. Com este código será localizado MARCA, MODELO e demais itens ligados ao item. Mascara: 999999-9, 999999.9, 9999999. |
| `codigo_cota` | Number | não | Código da cota de participação do veículo. Será selecionado baseado no valor fipe, tipo do veículo, regional e cooperativa. |
| `codigo_conta` | Number | não | Código da cota bancária. |
| `dia_vencimento` | Number | não | Dia de vencimento desejável pelo associado. |
| `codigo_alienacao` | Number | não | Código da alienação fiduciária. |
| `codigo_combustivel` | Number | não | Código do combustível do veículo. |
| `codigo_cor` | Number | não | Código da cor do veículo. |
| `codigo_tipo_veiculo` | Number | não | Código do tipo de veículo |
| `codigo_categoria_veiculo` | Number | não | Código da categoria veículo. |
| `logradouro` | String | não | Logradouro correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios. |
| `numero` | String | não | Número correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios. |
| `complemento` | String | não | Complemento correspondência. |
| `bairro` | String | não | Bairro correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios. |
| `cidade` | String | não | Cidade correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios. |
| `estado` | String | não | Estado correspondência. Informar DESCRIÇÃO ou SIGLA. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios. |
| `codigo_indicacao_externa` | Number | não | Código da indicação externa do veículo. |
| `cep` | String | não | Cep correspondência. Mascara: 99999-999 ou 99.999-999 ou somente números. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios. |
| `numero_nota` | Number | não | Número da nota fiscal do veículo. |
| `data_emissao_nota` | String | não | Data da emissão da nota fiscal do veículo. |
| `valor_fipe_protegido` | Number | não | Valor protegido do veículo escolhido pelo associado |
| `porcentagem_fipe_protegido` | Number | não | Porcentagem protegido do veículo escolhido pelo associado |
| `observacao` | String | não | Observação. |
| `valor_repasse` | String | não | Valor do repasse do veículo |
| `forma_pagamento_repasse` | String | não | Forma de pagamento do repasse. Formato R$ ou % |
| `codigo_modelo` | Number | não | Código do modelo do veículo |
| `gerar_cobranca_taxa_adm` | String | não | Gerar cobrança taxa administrativa. Formato "Y" ou "N". |
| `gerar_cobranca_rateio` | String | não | Gerar cobrança do rateio. Formato "Y" ou "N" |
| `codigo_classificacao` | Number | não | Código da classificação. |
| `valor_fipe` | Number | não | Valor fipe do veículo. |
| `codigo_tipo_envio_boleto` | Number | não | Código do tipo do envio do boleto. |
| `data_contrato` | String | não | Data Do contrato do veículo. |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `mensagem` | String | sim | Mensagem de retorno |
| `codigo_veiculo` | String | sim | Código do veículo alterado na base de dados |


**Exemplo Requisição:**
```json
{
"codigo_veiculo" : 9,
"codigo_associado" : 9,
"codigo_cooperativa" : 9,
"codigo_voluntario" : 9,
"codigo_fipe" :	"999999-9",
"ano_fabricacao" : "9999",
"ano_modelo" : "9999",
"placa" : "AAA-1234",
"chassi" : "99999999999999999",
"renavam" :	"99999",
"numero_motor" : "9",
"kilometragem" : "9",
"codigo_alienacao" : 9,
"codigo_combustivel" : 9,
"codigo_cor" : 9,
"codigo_tipo_veiculo" :	9,
"codigo_categoria_veiculo" : 9,
"codigo_cota" :	9,
"codigo_conta" : 0,
"dia_vencimento" : 10,
"logradouro" : "Rua Manoel Elias de Aguiar",
"numero" : "245",
"complemento" :	"Comercial",
"bairro" : "Ouro Preto",
"cidade" : "Belo Horizonte",
"estado" : "Minas Gerais",
"cep" :	"31.330-520",
"numero_nota" :	"99",
"data_emissao_nota" : "dd/mm/yyyy",
"quantidade_portas" : 9,
"cambio" : "M",
"valor_fipe_protegido" : "9999,99",
"porcentagem_fipe_protegido": "9,99",
"observacao" : "alteração via API"
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem" : "alterado",
"codigo_veiculo" : 9
}
```


---

## `POST /buscar/rateio-medio` — Buscar rateio

Calcula o rateio médio para veículos de uma determinada cota, baseando-se no valor fipe, tipo veículo e regional.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `valor_fipe` | Number | sim | Valor fipe do veículo |
| `codigo_regional` | Number | sim | Código da regional do veículo |
| `codigo_tipo_veiculo` | Number | sim | Código do tipo do veículo |
| `quantidade_meses_media` | Number | não | Quantidade de meses que serão usados para calcular a média do rateio. Caso não seja enviado a média será calculada baseada nos últimos 3 meses |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `mensagem` | String | sim | Mensagem de retorno |
| `valor_rateio_medio` | String | sim | Valor do rateio médio para o veículo |


**Exemplo Requisição:**
```json
{
"valor_fipe" : "99999,99",
"codigo_regional" : 9,
"codigo_tipo_veiculo" : "9",
"quantidade_meses_media" : "9"
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"valor_rateio_medio": "R$ 99,99"
}
```


---

## `GET /buscar/situacao-financeira-veiculo/:codigo_ou_placa` — Buscar situação Financeira

Busca a situação financeira do veículo


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_ou_placa` | String | sim | Código ou placa do veículo a ser consultado |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"cpf": "9999999999",
"nome": "HINOVA SOLUÇÕES DIGITAIS",
"codigo_veiculo": "999",
"placa": "AAA1111",
"chassi": "999999999",
"codigo_modelo": "99999",
"descricao_modelo": "MODELO",
"participa_fechamento": "SIM",
"codigo_situacao_veiculo": "9",
"descricao_situacao_veiculo": "ATIVO",
"situacao_financeira": "ADIMPLENTE"
}
```


---

## `POST /cadastrar/agregado` — Cadastrar Agregado


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_veiculo_vinculado` | Number | sim | Código do veículo ao qual o agregado será vinculado. |
| `ano_fabricacao` | Number | sim | Ano fabricação do veículo. Mascara: 9999 |
| `ano_modelo` | Number | sim | Ano modelo do veículo. Mascara: 9999 |
| `chassi` | String | sim | Chassi do veículo |
| `numero_motor` | String | sim | Número motor do veículo |
| `codigo_tipo_veiculo` | Number | sim | Código do tipo de veículo |
| `codigo_voluntario` | Number | não | Código do voluntário. Será selecionado de acordo com a cooperativa |
| `codigo_externo` | Number | não | Código externo do veículo. |
| `codigo_modelo` | String | não | Código do modelo do veículo. caso esteja enviando o código FIPE |
| `placa` | String | não | Placa do veículo. Caso o veículo seja ZERO KM não necessário enviar ou enviar vazio |
| `renavam` | String | não | Renavam do veículo. |
| `kilometragem` | Number | não | Kilometagem do veículo. |
| `cilindrada` | Number | não | Cilindrada do veículo. Utilizado quando o item é motocicleta. |
| `cambio` | String | não | Tipo do câmbio do veículo. Ele pode ser: A(automático), M(manual) ou 0(não informado). |
| `codigo_fipe` | String | não | Código fipe do veículo. caso envie o codigo_modelo. Com este código será localizado MARCA, MODELO e demais itens ligados ao item. Mascara: 999999-9, 999999.9, 9999999 |
| `codigo_cota` | Number | não | Código da cota de participação do veículo. Será selecionado baseado no valor fipe, tipo do veículo, regional e cooperativa |
| `dia_vencimento` | Number | não | Dia de vencimento desejável pelo associado. |
| `codigo_alienacao` | Number | não | Código da alienação fiduciária. |
| `codigo_combustivel` | Number | não | Código do combustível do veículo. |
| `codigo_cor` | Number | não | Código da cor do veículo. |
| `codigo_categoria_veiculo` | Number | não | Código da categoria veículo. |
| `logradouro` | String | não | Logradouro correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios |
| `numero` | String | não | Número correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios |
| `complemento` | String | não | Complemento correspondência. |
| `bairro` | String | não | Bairro correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios |
| `cidade` | String | não | Cidade correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios |
| `estado` | String | não | Estado correspondência. Informar DESCRIÇÃO ou SIGLA. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios |
| `cep` | String | não | Cep correspondência. Mascara: 99999-999 ou 99.999-999 ou somente números. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios |
| `numero_nota` | Number | não | Número da nota fiscal do veículo. |
| `data_emissao_nota` | String | não | Data da emissao da nota fiscal do veículo. |
| `data_contrato` | String | não | Data Do contrato do veículo. |
| `valor_adesao` | String | não | Valor da adesão. |
| `codigo_veiculo_indicador` | Number | não | Código do veículo que indicou o veículo sendo cadastrado. Caso seja enviado, o veículo indicador receberá 1 ponto |
| `codigo_forma_pagamento_adesao` | Number | não | Código da forma de pagamento da adesão. |
| `codigo_depreciacao` | Number | não | Código da depreciação. |
| `valor_fipe_protegido` | Number | não | Valor protegido do veículo. |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `mensagem` | String | sim | Mensagem de retorno |
| `codigo_agregado` | String | sim | Código do agregado inserido na base de dados |


**Exemplo Requisição:**
```json
{
"codigo_veiculo_vinculado":"999",
"codigo_modelo" : "99",
"valor_fipe" : "999,99",
"ano_fabricacao":"yyyy",
"placa":"AAA-1111",
"chassi":"99999999999999999999999",
"codigo_cota":"9",
"codigo_voluntario":"9",
"dia_vencimento":"9",
"codigo_tipo_veiculo":"9",
"codigo_categoria_veiculo":"9",
"codigo_forma_pagamento_adesao":"9"
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"codigo_veiculo": 999999,
"produtos": [
{
"codigo_produto": "9",
"situacao": "Produto adicionado ao veículo"
},
{
"codigo_produto": "99",
"situacao": "Implemento adicionado ao veículo"
}
]
}
```


---

## `GET /implemento-vinculado/listar/:codigoOuPlaca` — Listar Implementos Vinculados

Lista os implementos vinculados a um veículo


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigoOuPlaca` | String | sim | Código ou placa do veículo a ser consultado |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_veiculo": 999,
"codigo_implemento": 9,
"valor_fipe_implemento": "99.99",
"porcentagem": 9,
"somar_fipe": "N",
"codigo_usuario": 9,
"data_cadastro": "yyyy-mm-dd",
"hora_cadastro": "hh:ii:ss"
}
```


---

## `POST /listar/alteracao-veiculos` — Listar Alterações de Veículos

Lista as alterações de veículos em um intervalo de até 7 dias


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `data_inicial` | String | sim | Data inicial da pesquisa. Formato dd/mm/yyyy |
| `data_final` | String | sim | Data final da pesquisa. Formato dd/mm/yyyy |
| `ultima_alteracao` | String | não | Define se será exibida apenas a última alteração de cada veículo. Formato "Y" ou "N". Opcional |
| `campos` | Array | sim | Array contendo o nome dos campos do veículo que devem ser retornados |


**Exemplo Requisição:**
```json
{
"data_inicial": "dd/mm/yyyy",
"data_final": "dd/mm/yyyy",
"ultima_alteracao": "Y",
"campos": [
"codigo_situacao",
"placa",
"codigo_associado"
]
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
{
"codigo_alteracao": "999",
"codigo_veiculo": "99",
"placa": "AAA9999",
"chassi": "99999999999999",
"nome_campo_tabela": "placa",
"valor_anterior": "BBB9999",
"valor_posterior": "AAA9999",
"data_alteracao": "2020-10-24T00:00:00-0300",
"codigo_usuario_alteracao": "9",
"nome_usuario_alteracao": "HINOVA SOLUÇÕES DIGITAIS"
}
]
```


---

## `GET /listar/categoria-veiculo/:codigo_tipo/:situacao` — Listar categoria

Lista as categorias disponíveis de acordo com o tipo do veículo e a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Deve ser passado também o código do tipo do veículo Obs: A situação e o tipo são obrigatórios


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_tipo` | String | sim | Define o tipo do veículo, como cada categoria está atrelada a um tipo de veículo, só serão retornadas categorias que estejam associadas ao tipo de veículo definido |
| `situacao` | String | sim | Define qual a situação das categorias a serem retornadas, se a situação for "todos", serão retornadas as categorias ativas e inativas |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_categoria": "9",
"descricao_categoria": "PASSEIO",
"codigo_tipo_veiculo": "99",
"situacao": "ATIVO",
"valor_adesao": "0.00",
"participacao_minima": "0.00",
"porcentagem_fipe": "0.00"
}
```


---

## `GET /listar/combustivel/:situacao` — Listar combustível

Lista os combustíveis disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação dos combustíveis a serem retornados, se a situação for "todos", serão retornados todos os combustíveis, independente de estarem ativos ou inativos |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_combustivel" : "9",
"descricao_combustivel" : "GASOLINA"
}
```


---

## `GET /listar/cor/:situacao` — Listar cor

Lista as cores disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação das cores a serem retornadas, se a situação for "todos", serão retornadas todas as cores, independente de estarem ativas ou inativas |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_cor": "9",
"descricao_cor": "PRETO"
}
```


---

## `GET /listar/depreciacao/:situacao` — Listar Depreciação

Lista as depreciações disponíveis de acordo com a situação desejada, esta situação é obrigatória e pode ser: Ativo, Inativo ou Todos


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação das depreciações a serem retornadas, se a situação for "todos", serão retornadas as depreciações ativas e inativas |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_depreciacao": "9",
"descricao": "SEM DEPRECIAÇÃO",
"porcentagem_depreciacao": 9,
"padrao": "Y",
"situacao": "ATIVO"
}
```


---

## `GET /listar/implemento/:situacao` — Listar Implementos

Lista implementos cadastrados


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Situação dos implementos a serem retornados. Pode ser "ativo", "inativo", "todos" |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_implemento": "9",
"descricao": "CAÇAMBA",
"situacao": "ATIVO"
}
```


---

## `GET /listar/marca/:situacao` — Listar marca

Lista as marcas disponíveis de acordo com a situação desejada


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação das marcas a serem retornadas, se a situação for "todos", serão retornadas as marcas ativas e inativas |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_marca": "999",
"descricao": "DESCRIÇÃO MARCA",
"situacao": "ATIVO"
}
```


---

## `GET /listar/tipo-veiculo/:situacao` — Listar tipo

Lista os tipos de veículo disponíveis de acordo com a permissão do usuário e a situação desejada, esta situação é obrigatória e pode ser: Ativo, Inativo ou Todos


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação dos tipos a serem retornados, se a situação for "todos", serão retornados os tipos ativos e inativos |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_tipo": 99,
"descricao_tipo": "AUTOMÓVEL",
"cota_fipe_cilindrada": "FIPE",
"situacao": "ATIVO"
}
```


---

## `POST /modelo/listar` — Listar Modelos

Lista Veículos Cadastrados no SGA


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Situação dos modelos a serem retornados. Este parâmetro pode ser "ativo", "inativo" ou "todos". Obrigatório |
| `inicio_paginacao` | Number | sim | Define de qual item a lista deve começar. Caso não seja enviado, a lista irá começar pelo primeiro item do retorno. Opcional |
| `quantidade_por_pagina` | Number | sim | Quantidade de registros a serem exibidos por página. Caso não seja enviado, a quantidade será definida como 200. Opcional |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `mensagem` | String | sim | Mensagem de retorno |


**Exemplo Requisição:**
```json
{
"situacao": "ativo",
"inicio_paginacao" : 0 ,
"quantidade_por_pagina" : 50
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_modelo": "9999",
"descricao_modelo": "MODELO",
"codigo_marca": "99",
"descricao_marca": "MARCA",
"codigo_tipo_veiculo": "9",
"descricao_tipo_veiculo": "AUTOMÓVEL",
"situacao": "ATIVO"
}
```


---

## `GET /veiculo/buscar/:placaOuChassi` — Buscar

Lista os dados do veículo associado à placa ou chassi que foi passado como parâmetro de pesquisa


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `placaOuChassi` | String | sim | Placa ou Chassi do veículo a ser pesquisado pelo método de busca por placa ou chassi |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_veiculo": "999",
"placa": "AAA111",
"chassi": "99999999",
"codigo_fipe": "99999-9",
"valor_fipe": "99999.99",
"valor_fixo" : "999.99",
"valor_adesao" : "999.99",
"participacao" : "99.99",
"codigo_tipo_envio_boleto" : "9",
"descricao_tipo_envio_boleto" : "CORREIOS",
"forma_pagamento_protecao" : "9",
"ano_fabricacao": "yyyy",
"ano_modelo": "yyyy",
"renavam": "999999",
"codigo_cota": "9",
"cota": "COTA 0,26",
"codigo_regional": "99",
"codigo_cooperativa": "9",
"codigo_associado": "9999",
"codigo_tipo_veiculo": "99",
"codigo_categoria": "9",
"tipo": "AUTOMÓVEL",
"categoria": "PASSEIO",
"codigo_marca": "999",
"marca": "MARCA",
"codigo_modelo": "9999",
"modelo": "MODELO",
"codigo_combustivel": "9",
"codigo_cor": "9",
"nome": "NOME ASSOCIADO",
"rg": "MG 999999",
"cpf": "9999999999",
"telefone": "99999-99999",
"ddd": "99",
"telefone_celular": "99999-9999",
"ddd_celular": "99",
"telefone_celular_aux": "9999-9999",
"ddd_celular_aux": "99",
"telefone_comercial": "9999-9999",
"ddd_comercial": "99",
"email": "hinova@hinova.com.br",
"logradouro": "RUA MANOEL ELIAS DE AGUIAR",
"numero" : "245",
"complemento": "COMERCIAL",
"bairro": "OURO PRETO",
"cidade": "BELO HORIZONTE",
"estado": "MG",
"cep": "9999-999",
"codigo_situacao": "9",
"data_cadastro": "yyyy-mm-dd",
"data_contrato": "yyyy-mm-dd",
"descricao_situacao": "ATIVO",
"codigo_voluntario": "99",
"nome_voluntario": "VOLUNTÁRIO",
"cpf_voluntario": "99999999",
"codigo_veiculo_vinculado": "9"
}
```


---

## `POST /veiculo/cadastrar` — Cadastrar


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_associado` | Number | sim | Código do associado para vinculo ao veículo |
| `ano_fabricacao` | Number | sim | Ano fabricação do veículo. Mascara: 9999 |
| `ano_modelo` | Number | sim | Ano modelo do veículo. Mascara: 9999 |
| `codigo_tipo_veiculo` | Number | sim | Código do tipo de veículo. |
| `kilometragem` | Number | sim | Kilometagem do veículo. |
| `chassi` | String | sim | Chassi do veículo. |
| `numero_motor` | String | sim | Número motor do veículo. |
| `codigo_fipe` | String | sim | Código fipe do veículo. Com este código será localizado MARCA, MODELO e demais itens ligados ao item. Mascara: 999999-9, 999999.9, 9999999 |
| `codigo_cooperativa` | Number | não | Código da cooperativa. Será selecionado de acordo com a permissão do usuário |
| `dia_vencimento` | Number | sim | Dia de vencimento desejável pelo associado. |
| `codigo_voluntario` | Number | sim | Código do voluntário. |
| `codigo_externo` | Number | não | Código externo do veículo. |
| `codigo_modelo` | Number | não | Modelo do veículo |
| `placa` | String | não | Placa do veículo. Caso o veículo seja ZERO KM não necessário enviar ou enviar vazio |
| `renavam` | String | não | Renavam do veículo. |
| `cilindrada` | Number | não | Cilindrada do veículo. Utilizado quando o item é motocicleta. |
| `quantidade_portas` | Number | não | Quantidade de portas do veículo. |
| `cambio` | String | não | Tipo do câmbio do veículo. Ele pode ser: A(automático), M(manual) ou 0(não informado). |
| `codigo_cota` | Number | não | Código da cota de participação do veículo. Será selecionado baseado no valor fipe, tipo do veículo, regional e cooperativa |
| `codigo_conta` | Number | não | Código da cota bancária. |
| `codigo_alienacao` | Number | não | Código da alienação fiduciária. |
| `codigo_combustivel` | Number | não | Código do combustível do veículo. |
| `codigo_cor` | Number | não | Código da cor do veículo. |
| `codigo_categoria_veiculo` | Number | não | Código da categoria veículo. |
| `logradouro` | String | não | Logradouro correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios |
| `numero` | String | não | Número correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios |
| `complemento` | String | não | Complemento correspondência |
| `bairro` | String | não | Bairro correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios |
| `cidade` | String | não | Cidade correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios |
| `estado` | String | não | Estado correspondência. Informar DESCRIÇÃO ou SIGLA. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios |
| `cep` | String | não | Cep correspondência. Mascara: 99999-999 ou 99.999-999 ou somente números. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios |
| `numero_nota` | Number | não | Número da nota fiscal do veículo. |
| `data_emissao_nota` | String | não | Data da emissão da nota fiscal do veículo. |
| `data_contrato` | String | não | Data Do contrato do veículo. |
| `valor_adesao` | String | não | Valor da adesão. |
| `codigo_veiculo_indicador` | Number | não | Código do veículo que indicou o veículo sendo cadastrado. Caso seja enviado, o veículo indicador receberá 1 ponto |
| `codigo_forma_pagamento_adesao` | Number | não | Código da forma de pagamento da adesão. |
| `codigo_depreciacao` | Number | não | Código da depreciação. |
| `valor_fipe_protegido` | Number | não | Valor protegido do veículo. |
| `valor_fixo` | Number | não | Valor fixo do veículo. |
| `porcentagem_fipe_protegido` | Number | não | Porcentagem do valor FIPE protegido do veículo. |
| `participacao` | Number | não | Valor da participação do veículo. |
| `codigo_tipo_envio_boleto` | Number | não | Código do tipo do envio do boleto. |
| `quantidade_passageiros` | Number | não | Quantidade de passageiros que o veículo suporta. |
| `codigo_indicacao_externa` | Number | não | Código da indicação externa do veículo. |
| `observacao` | String | não | Observação. |
| `valor_repasse` | String | não | Valor do repasse do veículo |
| `forma_pagamento_repasse` | String | não | Forma de pagamento do repasse. Formato R$ ou % |
| `exibir_extrato_rateio` | String | não | Exibir extrato do rateio. Formato "Y" ou "N" |
| `gerar_cobranca_rateio` | String | não | Gerar cobrança do rateio. Formato "Y" ou "N" |
| `formato_cobranca` | String | não | Formato de cobrança do veículo. Mascara: B ou C. |
| `qtd_parcela` | String | não | Quantidade de parcelas. |
| `produtos` | Array | não | Array contendo os códigos dos produtos a serem vinculados ao veículo. Obs.: Se houver algum produto compulsório que se encaixe n perfil do veículo, ele irá ser vinculado automaticamente |
| `implementos` | Array | não | Array contendo os códigos, valores e somar fipe dos implementos a serem vinculados ao veículo. |
| `valor_fipe` | Number | não | Valor fipe do veículo. |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `mensagem` | String | sim | Mensagem de retorno |
| `codigo_veiculo` | String | sim | Código do veículo inserido na base de dados |


**Exemplo Requisição:**
```json
{
"codigo_associado" : 9,
"codigo_cooperativa" : 9,
"codigo_voluntario" : 9,
"codigo_fipe" :	"999999-9",
"ano_fabricacao" : "9999",
"ano_modelo" : "9999",
"placa" : "AAA-1234",
"chassi" : "99999999999999999",
"renavam" :	"99999",
"numero_motor" : "9",
"kilometragem" : "9",
"codigo_alienacao" : 9,
"codigo_combustivel" : 9,
"codigo_cor" : 9,
"codigo_tipo_veiculo" :	9,
"codigo_categoria_veiculo" : 9,
"codigo_cota" :	9,
"codigo_conta" : 0,
"valor_fixo" : "0.00",
"dia_vencimento" : 10,
"logradouro" : "Rua Manoel Elias de Aguiar",
"numero" : "245",
"complemento" :	"Comercial",
"bairro" : "Ouro Preto",
"cidade" : "Belo Horizonte",
"estado" : "Minas Gerais",
"cep" :	"31.330-520",
"numero_nota" :	99,
"data_emissao_nota" : "dd/mm/yyyy",
"quantidade_portas" : 9,
"cambio" : "M",
"valor_adesao" : "99,99",
"data_contrato" : "dd/mm/yyyy",
"codigo_externo" : "999",
"codigo_forma_pagamento_adesao" : 9,
"porcentagem_fipe_protegido" : "9,99",
"participacao" : "9,99",
"codigo_tipo_envio_boleto" : 9,
"codigo_indicacao_externa" : 9,
"quantidade_passageiros" : "9",
"exibir_extrato_rateio" : "Y",
"gerar_cobranca_rateio" : "Y",
"observacao" : "cadastro via API",
"produtos" : [
{
"codigo_produto" : 9
},
{
"codigo_produto" : 99
}
],
"implementos" : [
{
"codigo_implemento": "1999", 
"valor_fipe": "55,26",
"somar_fipe": "Y"
},
{
"codigo_implemento": 2, 
"valor_fipe": "48,54", 
"somar_fipe": "N"
}
]
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"codigo_veiculo": 999999,
"produtos": [
{
"codigo_produto": "9",
"situacao": "Produto adicionado ao veículo"
},
{
"codigo_produto": "99",
"situacao": "Implemento adicionado ao veículo"
}
]
}
```


---

## `POST /veiculo/foto/cadastrar` — Cadastrar foto

Adiciona fotos. A foto pode ser enviada como uma URL ou um arquivo binário. Limite de 50 fotos por requição.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_veiculo` | Number | sim | Código do veículo ao qual a foto deve ser vinculada.Opcional |
| `codigo_beneficiario` | Number | sim | Código do beneficiário ao qual a foto deve ser vinculada. Opcional |
| `codigo_evento` | Number | sim | Código do evento ao qual a foto deve ser vinculada. Opcional. Caso se esteja enviando um código de evento é obrigatório mandar um código de veículo que esteja incluso no evento |
| `foto` | Array | sim | Array contendo os índices: nome_arquivo (nome como o arquivo será salvo) codigo_tipo (código do tipo da foto que está sendo inserida) binario (arquivo binário da imagem) link (URL da imagem) Observação: Limite de 50 fotos por requisiçao; Observe que na primeira posição do vetor "foto", do exemplo de requisição, o índice "link" está preenchido e não foi colocado o índice "binario" não foi passado, pois a imagem foi passada como uma URL |


**Exemplo Requisição:**
```json
{
"codigo_veiculo" : 999,
"codigo_beneficiario" : 999,
"codigo_evento" : 999,
"foto" : [
{
"nome_arquivo" : "imagem.png",
"codigo_tipo" : 9,
"link" : "http://hinova.com.br/wp-content/uploads/2016/08/Hinova-Logo.png",
"observacao" : "foto com extensão .png passada por URL"
},
{
"nome_arquivo" : "foto.jpg",
"codigo_tipo" : 9,
"binario" : "iVBORw0KGgoAAAANSUhEUgAAA1IAAAI2CAIAAADVVi6oAAAKQ2lDQ1BJQ0MgcHJvZmlsZQAAeNqd U3dYk/cWPt/3ZQ9WQtjwsZdsgQAiI6wIyBBZohCSAGGEEBJAxYWIClYUFRGcSFXEgtUKSJ2I4qAouG",
"observacao" : "foto com extensão .jpg passada como um arquivo binário"
}
]
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
{
"nome_arquivo": "imagem.png",
"situacao": "Inserido"
},
{
"nome_arquivo": "foto.png",
"situacao": "Inserido"
}
]
```


---

## `POST /veiculo/produto/remover` — Remover produto

Remove uma lista de produtos do veículo de acordo com o array de produtos


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_veiculo` | Number | sim | Código do veículo retornado pelo método de inserção ou consulta veículo |
| `lista_codigo_produto` | Array | sim | Código dos produtos a serem removidos. Caso o veiculo não possua algum produto da lista enviada, o mesmo será ignorado aplicando a remoção apenas nos produtos vinculados ao veículo |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `mensagem` | String | sim | Mensagem de retorno |
| `codigo_veiculo` | String | sim | Código do veículo os produtos foram removidos |


**Exemplo Requisição:**
```json
{
"codigo_veiculo": 9,
"lista_codigo_produto": [
"1",
"2",
"3"
]
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"codigo_veiculo": 999
}
```


---

## `POST /veiculo/vincular/produto` — Vincular produto

Vincular uma lista de produtos ao veículo de acordo com o array de produtos


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_veiculo` | Number | sim | Código do veículo retornado pelo método de inserção ou consulta veículo |
| `lista_codigo_produto` | Array | sim | Código dos produtos a serem inseridos |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `mensagem` | String | sim | Mensagem de retorno |
| `codigo_veiculo` | String | sim | Código do veículo que recebeu o vinculo dos produtos |


**Exemplo Requisição:**
```json
{
"codigo_veiculo": "9",
"lista_codigo_produto":	[
"1",
"2",
"3"
]
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"codigo_veiculo": 999999
}
```


---

## `POST /vincular/implemento` — Vincular implemento

Vincula um implemento a um certo veículo


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_veiculo` | Number | sim | Código do veículo |
| `codigo_implemento` | Number | sim | Código do implemento a ser vinculado |
| `valor_fipe` | Number | não | Valor FIPE do implemento. |
| `porcentagem` | Number | não | Porcentagem cobrada do implemento. |
| `somar_fipe` | String | não | Define se deseja ou não somar ao valor FIPE do veículo. Deve ser no formato "Y"(sim) ou "N"(não) |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `mensagem` | String | sim | Mensagem de retorno |
| `codigo_veiculo` | Number | sim | Código do veículo que recebeu o vinculo do implemento |


**Exemplo Requisição:**
```json
{
"codigo_veiculo" : "999",
"codigo_implemento" : "9",
"valor_fipe" : "99,99",
"somar_fipe" : "N",
"porcentagem" : "9,99"
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"codigo_veiculo": 999,
"codigo_implemento": 9
}
```


---

## `GET buscar/situacao-veiculo/:placaOuChassi` — Buscar situação veículo

Busca a situação do veículo desejado


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `placaOuChassi` | String | sim | Placa ou chassi do veículo a ser consultado |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_veiculo": "999",
"placa": "aaa1111",
"chassi": "99999999999999999",
"codigo_situacao": "9"
}
```


---

## `GET listar/alienacao/:situacao` — Listar Alienação

Lista as alienações cadastradas no sistema.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação das alienações a serem retornadas(ativo ou inativo), se a situação for "todos", serão retornadas todas as alienações, independente de estarem ativas ou inativas |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_alienacao": 9,
"nome_alienacao": "ALIENAÇÃO",
"ddd": "99",
"telefone": "9999-9999",
"ddd_telefone_comercial": "99",
"telefone_comercial": "9999-9999"
}
```


---

## `GET listar/conta/:situacao` — Listar conta bancária

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
"codigo_conta" : 9,
"codigo_agencia": 99,
"codigo_banco":	99,
"descricao_banco": "HINOVA BANK",
"situacao":	"ATIVO"
}
```


---

## `GET listar/forma-pagamento/:situacao` — Listar Forma Pag.

Lista as formas de pagamento cadastradas no sistema.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação das formas de pagamento a serem retornadas(ativo ou inativo), se a situação for "todos", serão retornadas todas as formas de pagamento, independente de estarem ativas ou inativas |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_mgfformapagamento": "9",
"descricao": "BOLETO",
"situacao": "ATIVO"
}
```


---

## `GET listar/situacao/:situacao` — Listar situação

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

## `POST listar/veiculo` — Listar

Lista os veículos de acordo com a situação especificada


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_situacao` | String | sim | Define qual a situação dos veículos a serem listados. O codigo_situacao é obrigatório |
| `data_contrato` | String | não | Define qual a data do contrato dos veículos a serem listados. |
| `inicio_paginacao` | Number | sim | Define qual o início da paginação. Se não for enviado, o início da paginação será 0. |
| `quantidade_por_pagina` | Number | sim | Define a quantidade de registros exibidos por página. Se não for enviado, a quantidade de registros por página será de 5000. |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"mostrando ": "1",
"numero_paginas": 99,
"veiculos": [
{
"codigo_veiculo": "999",
"placa": "AAA111",
"chassi": "99999999999",
"renavam": "999999",
"codigo_associado": "999",
"codigo_tipo": "9",
"codigo_categoria": "99",
"tipo": "AUTOMÓVEL",
"categoria": "PASSEIO",
"marca": "MARCA",
"modelo": "MODELO",
"nome_associado": "ASSOCIADO",
"rg_associado": "MG 9999999",
"cpf_associado": "999999999",
"telefone": "9999-9999",
"ddd": "99",
"telefone_celular": "99999-9999",
"ddd_celular": "99",
"telefone_celular_aux": "9999-9999",
"ddd_celular_aux": "99",
"telefone_comercial": "99999-9999",
"ddd_comercial": "99",
"email": "hinova@gmail.com",
"codigo_situacao": "9",
"codigo_voluntario": "9",
"nome_voluntario": "VOLUNTARIO",
"cpf_voluntario": "9999999999"
}
]
}
```


---

## `GET produto-adicional/remover/:codigo_veiculo/:codigo_produto_adicional` — Remover Prod. Adicional

Remove determinado produto adicional de um veículo


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_veiculo` | String | sim | Código do veículo do qual deseja-se remover o produto adicional |
| `codigo_produto_adicional` | String | sim | Código do produto adicional que deseja-se remover |


**Exemplo Retorno:**
```json
HTTP/1.1 207 OK
{
"mensagem": "Alterado",
"codigo_produto_adicional": 321
}
```


---

## `GET tipo-adesao/listar/:situacao` — Listar Tipo Adesão

Lista os Tipos de Adesões cadastrados no sistema


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define se os tipos de adesão a serem retornados devem estar ativos, inativos ou seleciona todas independente da situação dela. Este parâmetro pode ser "ativo", "inativo" ou "todos" |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_tipoadesao": "9",
"descricao": "ADESÃO",
"situacao": "ATIVO"
}
```


---

## `GET veiculo/alterar-situacao-para/:codigo_situacao/:codigo_veiculo` — Alterar situação

Altera a Situação do Veículo de acordo com o código do veículo


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_situacao` | String | sim | Define qual a nova Situação do veículo |
| `codigo_veiculo` | string | sim | Código do Veículo o qual se deseja mudar a situação |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "Alterado",
"codigo_veiculo": 999
}
```


---

## `GET veiculo/listar-veiculo-produto/:codigo_situacao` — Lista prod. vinculado

Lista os veículos que estão na situação especificada e os produtos vinculados a cada veículo


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_situacao` | String | sim | Define a situação dos veículos a serem retornados |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_veiculo": "9",
"placa": "AAA9999",
"chassi": "9999999999999999999",
"renavam": "9999999999",
"codigo_associado": "9",
"codigo_tipo": "9",
"codigo_categoria": "9",
"descricao_tipo": "AUTOMÓVEL",
"descricao_categoria": "PASSEIO",
"descricao_cota": "DESCRIÇÃO COTA",
"valor_fipe": 99999,
"valor_fixo": 9,
"km": 9,
"numero_motor": "99",
"descricao_combustivel": "FLEX",
"descricao_cor": "PRATA",
"ano_modelo": 2021,
"ano_fabricacao": 2021,
"descricao_marca": "MARCA",
"descricao_modelo": "MODELO",
"nome": "HINOVA SOLUÇÕES DIGITAIS",
"rg": "MG99999999",
"cpf": "99999999999",
"telefone": "9999-9999",
"ddd": "99",
"telefone_celular": "99999-9999",
"ddd_celular": "99",
"telefone_celular_aux": "9999",
"ddd_celular_aux": "99",
"telefone_comercial": "9999-9999",
"ddd_comercial": "99",
"email": "hinova@hinova.com.br",
"data_cadastro_veiculo": "2020-01-01",
"data_contrato_veiculo": "2020-01-01",
"hora_cadastro_veiculo": "00:00:00",
"produtos_vinculados": [
{
"codigo_produto": "1",
"codigo_veiculo": "9",
"valor_produto": "99.00",
"descricao_produto": "PRODUTO 1",
"descricao_boleto": "PRODUTO 1"
},
{
"codigo_produto": "2",
"codigo_veiculo": "9",
"valor_produto": "99.00",
"descricao_produto": "PRODUTO 2",
"descricao_boleto": "PRODUTO 2"
}
]
}
```


---
