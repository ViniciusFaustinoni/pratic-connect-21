# Boleto (12 endpoints)

Base URL: `https://api.hinova.com.br/api/sga/v2`. Todos os endpoints (exceto `/usuario/autenticar`) exigem header `Authorization: Bearer <token_usuario>`.

---

## `POST /boleto/cadastrar` — Cadastrar


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_associado` | Number | sim | Código do associado ao qual o boleto pertence |
| `codigo_tipo_boleto` | Number | sim | Código do tipo do boleto |
| `codigo_regional` | Number | sim | Código da regional a qual o associado pertence |
| `codigo_conta` | Number | sim | Código do banco. Obrigatório caso tenha mais de uma conta bancária cadastrada para a regional |
| `codigo_situacao` | Number | sim | Código da situação do boleto |
| `mes_referente` | String | sim | Mês referente do boleto |
| `link_boleto` | Bool | sim | Retorna o link do boleto |
| `array_parcela` | Array | sim | Array contendo os índices: valor (valor da parcela) vencimento (data de vencimento do boleto) |
| `referencia` | Array | sim | Array contendo os índices: modulo (módulo referente do boleto, ele pode ser: beneficiário, veiculo ou cliente) codigo_modulo (código do módulo, se o módulo for "beneficiário", o código_modulo será o código do beneficiário, se for "veiculo" será o código do veículo e se for "cliente" será o código do cliente) descricao (descrição do boleto) codigo_produto (código do produto incluso no boleto, caso não tenham produtos não é preciso incluir este índice) valor (valor da referência) |
| `email` | String | não | e-Mail do associado. |
| `numero_banco` | Number | não | Número do banco do boleto. |
| `data_emissao` | String | não | Data de emissão do boleto. |
| `linha_digitavel` | String | não | Linha digitável do boleto, caso já tenha sido gerando em outro sistema. |
| `codigo_barras` | String | não | Código de barras do boleto, caso já tenha sido gerando em outro sistema. |
| `codigo_tipo_cobranca_recorrente` | Number | não | Código do tipo de cobrança recorrente. Utilize o método {Listar Tipo Cobrança Recorrente} para ver a listagem de códigos |
| `dados_baixa` | Array | não | Array contendo o índice: data_pagamento - Máscara dd/mm/yyyy |


**Resposta (sucesso):**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `mensagem` | String | sim | Mensagem de retorno |
| `nosso_numero` | String | sim | nosso_numero |


**Exemplo Requisição:**
```json
{
"codigo_associado" : "999",
"codigo_tipo_boleto" : "9",
"codigo_regional" : "9",
"codigo_conta" : "99",
"codigo_situacao" : "1",
"mes_referente" : "99/9999",
"link_boleto"  :  true,
"numero_banco":86257682,
"data_emissao":"dd/mm/yyyy",
"linha_digitavel":"99999999999999999999999999999999999",
"codigo_barras":"99999999999999999999999999999",
"dados_baixa":{
"data_pagamento": "10/05/2021"
},
"array_parcela" : [
{
"valor" : "999,99",
"vencimento" : "99/99/9999"
},
{
"valor" : "999,99",
"vencimento" : "99/99/9999"
},
{
"valor" : "999,99",
"vencimento" : "99/99/9999"
}
],
"referencia" : [
{
"modulo" : "beneficiario",
"codigo_modulo" : "9999",
"descricao" : "exemplo de descrição",
"codigo_produto" : "9",
"valor" : "99,99"
},
{
"modulo" : "veiculo",
"codigo_modulo" : "999",
"descricao" : "exemplo de descrição",
"codigo_produto" : "9",
"valor" : "999,99"
},
{
"modulo" : "beneficiario",
"codigo_modulo" : "999",
"descricao" : "exemplo de descrição",
"codigo_produto" : "9",
"valor" : "9,99"
}
]
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"dados_boleto_inserido": [
{
"nosso_numero": 9999,
"linha_digitavel": "99999.99999 99999.999999 99999.99999 9 9999999999999",
"link_boleto" : "Link do boleto gerado"
},
{
"nosso_numero": 999,
"linha_digitavel": "99999.999999 99999.999999 99999.99999 9 9999999999",
"link_boleto" : "Link do boleto gerado"
}
]
}
```


---

## `POST /listar/boleto-associado-veiculo` — Listar por associado/veículo

Lista todos os boletos de um associado ou veículo em um determinado intervalo de tempo, sendo obrigatório enviar o código ou cpf do associado ou o código ou placa do veículo e ao menos um par de data inicial e final. O limite do intervalo de tempo é de, no máximo, 90 dias


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_associado` | Number | sim | Código do associado ao qual os boletos estão vinculados |
| `codigo_veiculo` | Number | sim | Código do veículo ao qual os boletos estão vinculados |
| `cpf_associado` | String | sim | CPF do associado ao qual os boletos estão vinculados |
| `placa` | String | sim | Placa do veículo ao qual os boletos estão vinculados |
| `codigo_situacao_boleto` | Number | não | Código da situação dos boletos a serem retornados |
| `data_vencimento_inicial` | String | não | Data inicial do vencimento dos boletos a serem retornados. |
| `data_vencimento_final` | String | não | Data final do vencimento dos boletos a serem retornados. |
| `data_vencimento_original_inicial` | String | não | Data inicial do vencimento original dos boletos a serem retornados. |
| `data_vencimento_original_final` | String | não | Data final do vencimento original dos boletos a serem retornados. |
| `data_pagamento_inicial` | String | não | Data inicial do pagamento dos boletos a serem retornados. |
| `data_pagamento_final` | String | não | Data final do pagamento dos boletos a serem retornados. |
| `data_emissao_inicial` | String | não | Data inicial da emissão dos boletos a serem retornados. |
| `data_emissao_final` | String | não | Data final da emissão dos boletos a serem retornados. |


**Exemplo Requisição:**
```json
{
"placa" : "AAA-9999",
"data_vencimento_original_inicial": "99/99/9999",
"data_vencimento_original_final": "99/99/9999",
}
```

**Exemplo Requisição:**
```json
{
"cpf_associado": "123.454.457.99",
"data_emissao_inicial": "99/99/9999",
"data_emissao_final": "99/99/9999"
}
```

**Exemplo Requisição:**
```json
{
"codigo_associado": "9",
"data_pagamento_inicial": "99/99/9999",
"data_pagamento_final": "99/99/9999"
}
```

**Exemplo Requisição:**
```json
{
"codigo_veiculo": "9",
"codigo_situacao_boleto": "9",
"data_vencimento_inicial": "99/99/9999",
"data_vencimento_final": "99/99/9999"
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"nosso_numero": 9999,
"linha_digitavel": "99999.99999 999999.99999 99999.999999 9 9999999999",
"codigo_tipo_boleto": "9",
"tipo_boleto": "FECHAMENTO",
"valor_boleto": "999.99",
"valor_multa": "9.999",
"valor_mora": "9.9",
"valor_boleto_multa_mora": "999.99",
"quantidade_dias_vencidos": 99,
"codigo_associado": 999,
"nome_associado": "HINOVA SOLUÇÕES DIGITAIS",
"cpf": "99999999",
"telefone_fixo": "(99) 99999-9999",
"celular": "(99) 99999-9999",
"telefone_comercial": "(99) 9999-9999",
"email": "hinova@hinova.com.br",
"email_auxiliar": "hinova.aux@hinova.com",
"data_inicio_contrato_associado": "yyyy-mm-dd",
"data_fim_contrato_associado": "yyyy-mm-dd",
"data_emissao": "yyyy-mm-dd",
"data_vencimento": "yyyy-mm-dd",
"data_vencimento_original": "yyyy-mm-dd",
"data_pagamento":"yyyy-mm-dd",
"codigo_situacao_boleto": "9",
"situacao_boleto": "ABERTO",
"veiculos": [
{
"codigo_veiculo": 999,
"codigo_tipo_veiculo": "9",
"codigo_regional": "9",
"placa": "AAA1111",
"chassi": "9999999999",
"renavam": "99999",
"codigo_fipe": "99999-9",
"modelo": "MODELO VEíCULO",
"ano_modelo": "yyyy",
"marca": "MARCA VEíCULO",
"valor_protegido": "9999,99",
"valor_fipe": "9999,99",
"valor_adesao": "99,99",
"data_inicio_contrato_veiculo": "yyyy-mm-dd",
"data_fim_contrato_veiculo": "yyyy-mm-dd",
"situacao_veiculo": "PENDENTE",
"total_taxas_produtos": 99,
"total_taxas": "99,99",
"taxas": [
{
"descricao_taxa": "EXEMPLO DE DESCRIçãO",
"valor_taxa": "99,99"
}
]
}
]
}
```


---

## `POST /listar/boleto-associado/periodo` — Listar por período

Lista todos os boletos em um determinado intervalo de tempo, sendo obrigatório enviar ao menos um par de data inicial e final. O limite do intervalo de tempo é de, no máximo, 31 dias


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `data_vencimento_inicial` | String | não | Data inicial do vencimento dos boletos a serem retornados. |
| `data_vencimento_final` | String | não | Data final do vencimento dos boletos a serem retornados. |
| `data_vencimento_original_inicial` | String | não | Data inicial do vencimento original dos boletos a serem retornados. |
| `data_vencimento_original_final` | String | não | Data final do vencimento original dos boletos a serem retornados. |
| `data_pagamento_inicial` | String | não | Data inicial do pagamento dos boletos a serem retornados. |
| `data_pagamento_final` | String | não | Data final do pagamento dos boletos a serem retornados. |
| `data_emissao_inicial` | String | não | Data inicial da emissão dos boletos a serem retornados. |
| `data_emissao_final` | String | não | Data final da emissão dos boletos a serem retornados. |
| `codigo_tipo_boleto` | Number | não | Código do tipo do boleto. |
| `codigo_situacao_boleto` | Number | não | Código da situação do boleto. |
| `quantidade_por_pagina` | Number | não | Quantidade de registros a serem exibidos por página. Caso não seja enviado, a quantidade será definida como 3000 |
| `inicio_paginacao` | Number | não | Define que qual item a lista deve começar. Caso não seja enviado, a lista irá começar pelo primeiro item do retorno |
| `codigo_banco` | Number | não | Código do banco dos boletos a serem retornados. |
| `mes_referente` | String | não | Mês referente dos boletos a serem retornados. Formato mm/yyyy |


**Exemplo Requisição:**
```json
{
"nosso_numero": "9",
"data_vencimento_original_inicial": "99/99/9999",
"data_vencimento_original_final": "99/99/9999",
"inicio_paginacao": 2,
"quantidade_por_pagina": 50
}
```

**Exemplo Requisição:**
```json
{
"data_emissao_inicial": "99/99/9999",
"data_emissao_final": "99/99/9999"
}
```

**Exemplo Requisição:**
```json
{
"codigo_banco": "9",
"data_pagamento_inicial": "99/99/9999",
"data_pagamento_final": "99/99/9999"
}
```

**Exemplo Requisição:**
```json
{
"codigo_situacao_boleto": "9",
"data_vencimento_inicial": "99/99/9999",
"data_vencimento_final": "99/99/9999"
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"nosso_numero": 9999,
"codigo_tipo_boleto" : "9",
"tipo_boleto" : "FECHAMENTO"
"codigo_associado": 999,
"nome_associado": "HINOVA",
"cpf": "999999999",
"telefone_fixo": "(99)9999-99999",
"celular": "(99)9999-99999",
"telefone_comercial": "(99)9999-99999",
"email": "hinova@hinova.com.br",
"email_auxiliar": "hinova.solucoesdigitais@hinova.com",
"data_inicio_contrato_associado": "yyyy-mm-dd",
"data_fim_contrato_associado": "yyyy-mm-dd",
"data_emissao": "yyyy-mm-dd",
"data_vencimento": "yyyy-mm-dd",
"data_vencimento_original": "yyyy-mm-dd",
"data_pagamento":"yyyy-mm-dd",
"codigo_situacao_boleto": "9",
"situacao_boleto": "BAIXADO",
"codigo_banco": "22",
"mes_referente": "05\/2019"
"veiculos": [
{
"codigo_veiculo": 999,
"codigo_tipo_veiculo": "9",
"codigo_regional": "9",
"placa": "AAA999",
"chassi": "9999AA999",
"renavam" : "9999999",
"codigo_fipe": "99999-9",
"modelo" : "MODELO VEICULO",
"ano_modelo" : "9999",
"marca" : "MARCA VEICULO"
"valor_protegido": "9999,00",
"valor_fipe": "99999,00",
"valor_adesao": "9,00",
"data_inicio_contrato_veiculo": "yyyy-mm-dd",
"data_fim_contrato_veiculo": "yyyy-mm-dd",
"situacao_veiculo" : "ATIVO"
"total_produtos": "99,00",
"produtos": [
"99:ASSISTÊNCIA 24 HORAS:99,00",
"999:COBERTURA PARA 3°:999,00",
"9:RATEIO COTA 2,00:99,00",
"9999:TAXA ADMINISTRATIVA COTA: 99,00"
]
},
{
"codigo_veiculo": 9999,
"codigo_tipo_veiculo": "9",
"codigo_regional": "9",
"placa": "AAA9999",
"chassi": "99999999",
"renavam" : "9999999",
"codigo_fipe": "99999-9",
"modelo" : "MODELO VEICULO",
"ano_modelo" : "9999",
"marca" : "MARCA VEICULO"
"valor_protegido": "999,00",
"valor_fipe": "9999,00",
"valor_adesao": "99,00",
"data_inicio_contrato_veiculo": "yyyy-mm-dd",
"data_fim_contrato_veiculo": "yyyy-mm-dd",
"total_produtos": "99,00",
"produtos": [
"99:ASSISTÊNCIA 24 HORAS:99,00"
]
}
]
}
```


---

## `POST alterar/vencimento-boleto` — Alterar Vencimento

Altera a data de vencimento de um determinado boleto, respeitando as permissões de manutenção de boleto do usuário.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nosso_numero` | Number | sim | Nosso numero do boleto a ser alterado. |
| `nova_data_vencimento` | String | sim | Nova data de vencimento. Mascara dd/mm/yyyy |


**Exemplo Requisição:**
```json
{
"nosso_numero" : "999",
"nova_data_vencimento" : "dd/mm/yyyy"
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"mensagem": "OK",
"nosso_numero": 9999,
"linha_digitavel": "9999.999999 99999.99999 99999.999999 9 9999999999",
"link_boleto" : "Link do boleto gerado"
"nova_data_vencimento": "dd/mm/yyyy",
"alerta": "É necessário gerar uma remessa corretiva devido à alteração do boleto"
}
```


---

## `GET buscar/boleto/:nosso_numero` — Buscar

Busca boleto pelo parâmetro nosso_numero


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nosso_numero` | Number | sim | Nosso número do boleto a ser pesquisado |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_associado": "9",
"nome_associado": "A-Z",
"cpf_associado": "999.999.999-99",
"codigo_situacao_associado": "9",
"descricao_situacao_associado": "A-Z",
"codigo_regional_associado": "9",
"nome_regional_associado": "A-Z",
"nosso_numero": "9",
"codigo_situacao_boleto": "9",
"descricao_situacao_boleto": "AAA",
"codigo_regional_boleto": "9",
"nome_regional_boleto": "A-Z",
"mes_referente": "99/999",
"data_emissao": "9999-99-99",
"data_vencimento_original": "9999-99-99",
"data_vencimento": "9999-99-99",
"valor_boleto": "99.99",
"data_pagamento": "9999-99-99",
"valor_pagamento": "99.99",
"data_credito_banco": "9999-99-99",
"descricao_forma_pagamento": "A-Z",
"descricao_tipo_baixa_boleto": "A-Z",
"parcela_paga": "9",
"qtde_parcela_carne": "9",
"descricao_tipo_cobranca_recorrente": "A-Z",
"codigo_tipo_boleto": "9",
"descricao_tipo_boleto": "A-Z",
"codigo_conta": "9",
"codigo_banco": "9",
"nome_banco": "A-Z",
"agencia_bancaria": "9",
"conta_bancaria" : "9",
"linha_digitavel" : "9999.999999 999999.999999 9999.99999 9 9999999999",
"link_boleto" : "Link do boleto gerado",
"veiculos": [
{
"codigo_veiculo": "9",
"placa": "A-Z",
"chassi": "A-Z",
"valor_fixo": "99.99",
"codigo_situacao_veiculo": "9",
"descricao_situacao_veiculo": "A-Z",
"codigo_tipo_veiculo": "9",
"descricao_tipo_veiculo": "A-Z",
"codigo_modelo": "9",
"descricao_modelo": "A-Z",
"valor_fipe": "99.99",
"codigo_vencimento_veiculo": "9",
"dia_vencimento_veiculo": "99",
"codigo_tipo_envio_boleto": "9",
"descricao_tipo_envio_boleto": "A-Z",
"codigo_cooperativa_veiculo": "9",
"nome_cooperativa_veiculo": "A-Z"
}
]
}
```


---

## `POST listar/boleto` — Listar

Lista boletos emitidos,


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_situacao` | Number | sim | Código da situação do boleto. É obrigatório |
| `data_emissao_inicial` | String | não | Filtra pela data de emissão, será o início das datas a serem filtradas |
| `data_emissao_final` | String | não | Filtra pela data de emissão, será o fim das datas a serem filtradas |
| `data_vencimento_inicial` | String | não | Filtra pela data de vencimento, será o início das datas a serem filtradas |
| `data_vencimento_final` | String | não | Filtra pela data de vencimento, será o início das datas a serem filtradas |
| `data_vencimento_original_inicial` | String | não | Filtra pela data de vencimento original, será o início das datas a serem filtradas |
| `data_vencimento_original_final` | String | não | Filtra pela data de vencimento original, será o início das datas a serem filtradas |
| `data_pagamento_inicial` | String | não | Filtra pela data de pagamento, será o início das datas a serem filtradas |
| `data_pagamento_final` | String | não | Filtra pela data de pagamento será o início das datas a serem filtradas |
| `mes_referente` | String | não | Filtra pelo mês/ano referente do boleto a ser listado |
| `codigo_associado` | Num | não | Filtra pelo código do associado ao qual o boleto está vinculado |
| `codigo_boleto` | Num | não | Filtra pelo código do boleto a ser listado |


**Exemplo Requisição:**
```json
{
"nosso_numero": "9",
"data_vencimento_original_inicial": "99/99/9999",
"data_vencimento_original_final": "99/99/9999",
"mes_referente": "99/9999",
}
```

**Exemplo Requisição:**
```json
{
"data_emissao_inicial": "99/99/9999",
"data_emissao_final": "99/99/9999"
}
```

**Exemplo Requisição:**
```json
{
"codigo_associado": "9",
"data_pagamento_inicial": "99/99/9999",
"data_pagamento_final": "99/99/9999"
}
```

**Exemplo Requisição:**
```json
{
"codigo_situacao": "9",
"data_vencimento_inicial": "99/99/9999",
"data_vencimento_final": "99/99/9999"
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_associado": "9",
"nome_associado": "A-Z",
"cpf_associado": "99999999999",
"codigo_situacao_associado": "9",
"descricao_situacao_associado": "A-Z",
"codigo_regional_associado": "9",
"nome_regional_associado": "A-Z",
"codigo_boleto": "9"
"nosso_numero": "9",
"codigo_situacao_boleto": "9",
"descricao_situacao_boleto": "A-Z",
"codigo_regional": "9"
"nome_regional_boleto": "A-Z",
"mes_referente": "99/9999",
"data_emissao": "9999-99-99T00:00:00-0000",
"data_vencimento_original": "9999-99-99T00:00:00-0000",
"data_vencimento": "9999-99-99T00:00:00-0000",
"valor_boleto": "99.99",
"data_pagamento": "9999-99-99T00:00:00-0000",
"valor_pagamento": "99.99",
"data_credito_banco": "9999-99-99",
"codigo_forma_pagamento": "9",
"descricao_forma_pagamento": "A-Z",
"parcela_paga": "9",
"qtde_parcela": "9",
"descricao_tipo_cobranca_recorrente": "A-Z",
"codigo_banco": "9"
"codigo_tipo_boleto": "9",
"descricao_tipo_boleto": "A-Z",
"codigo_conta": "9",
"codigo_banco": "9",
"nome_banco": "A-Z",
"agencia": "9",
"conta": "9",
"descricao_tipo_baixa_boleto": "A-Z"
}
```


---

## `POST listar/boleto/periodo` — Listar Boleto Associado Beneficiario

Lista boletos emitidos de associados ou beneficiários.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_associado` | Number | não | Filtra pelo código do associado ao qual o boleto está vinculado |
| `cpf_associado` | Number | não | Filtra pelo cpf do associado ao qual o boleto está vinculado |
| `codigo_beneficiario` | Number | não | Filtra pelo código do beneficiário ao qual o boleto está vinculado |
| `cpf_beneficiario` | Number | não | Filtra pelo cpf do beneficiário ao qual o boleto está vinculado |
| `codigo_situacao_boleto` | Number | não | Código da situação do boleto. |
| `data_emissao_inicial` | String | não | Filtra pela data de emissão, será o início das datas a serem filtradas |
| `data_emissao_final` | String | não | Filtra pela data de emissão, será o fim das datas a serem filtradas |
| `data_vencimento_inicial` | String | não | Filtra pela data de vencimento, será o início das datas a serem filtradas |
| `data_vencimento_final` | String | não | Filtra pela data de vencimento, será o início das datas a serem filtradas |
| `data_vencimento_original_inicial` | String | não | Filtra pela data de vencimento original, será o início das datas a serem filtradas |
| `data_vencimento_original_final` | String | não | Filtra pela data de vencimento original, será o início das datas a serem filtradas |
| `data_pagamento_inicial` | String | não | Filtra pela data de pagamento, será o início das datas a serem filtradas |
| `data_pagamento_final` | String | não | Filtra pela data de pagamento será o início das datas a serem filtradas |
| `quantidade_por_pagina` | Number | não | Limita a quantidade de registros do retorno |
| `inicio_paginacao` | Number | não | Indica a páginação desejada dos resultado |


**Exemplo Requisição:**
```json
{
"codigo_beneficiario": 99,
"data_vencimento_original_inicial": "99/99/9999",
"data_vencimento_original_final": "99/99/9999",
"quantidade_por_pagina": 1,
"inicio_paginacao": 0
}
```

**Exemplo Requisição:**
```json
{
"codigo_associado": "9",
"codigo_situacao_boleto": 9,
"data_pagamento_inicial": "99/99/9999",
"data_pagamento_final": "99/99/9999"
}
```

**Exemplo Requisição:**
```json
{
"cpf_associado": "99999999999",
"data_vencimento_inicial": "99/99/9999",
"data_vencimento_final": "99/99/9999"
}
```

**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
  {
    "nosso_numero": 99999999,
    "data_emissao": "9999-99-99",
    "data_vencimento_original": "9999-99-99",
    "data_vencimento": "9999-99-99",
    "valor_boleto": "999.99",
    "valor_pagamento": 0,
    "data_pagamento": "",
    "parcela_paga": 9,
    "qtde_parcela_carne": "9",
    "codigo_tipo_boleto": "9",
    "linha_digitavel": "99999.99999 99999.999999 99999.999999 9 99999999999999",
    "codigo_situacao_boleto": "9",
    "situacao_boleto": "ABERTO",
    "tipo_boleto": "FECHAMENTO",
    "link_boleto": "LINK DO BOLETO",
    "codigo_associado": "999",
    "cpf": "99999999999",
    "email": "email@email.com",
    "email_auxiliar": "email@email.com",
    "nome_associado": "NOME ASSOCIADO",
    "data_inicio_contrato_associado": "9999-99-99",
    "data_fim_contrato_associado": "9999-99-99",
    "telefone": "(99) 9999-99999",
    "celular": "(99) 9999-99999",
    "beneficiario": [
      {
        "codigo_beneficiario": "999",
        "nome": "NOME BENEFICIÁRIO",
        "cpf": "99999999999",
        "data_contrato": "9999-99-99",
        "sexo": "M",
        "situacao": "INADIMPLENTE",
        "total_taxas": "9.99",
        "taxas": [
          {
            "descricao_taxa": "TAXA",
            "valor_taxa": "9.99"
          }
        ],
        "total_beneficios": "9.99",
        "beneficios": [
          {
            "descricao_beneficio": "BENEFICIO 1",
            "valor_beneficio": "9.99"
          },
          {
            "descricao_beneficio": "BENEFICIO 2",
            "valor_beneficio": "9.99"
          }
        ]
      },
      {
        "codigo_beneficiario": "99999",
        "nome": "NOME BENEFICIÁRIO 2",
        "cpf": "99999999999",
        "data_contrato": "9999-99-99",
        "sexo": "F",
        "situacao": "INADIMPLENTE",
        "total_taxas": "9.99",
        "taxas": [
          {
            "descricao_taxa": "TAXA",
            "valor_taxa": "9.99"
          }
        ],
        "total_beneficios": "9.99",
        "beneficios": [
          {
            "descricao_beneficio": "BENEFÍCIO",
            "valor_beneficio": "9.99"
          }
        ]
      }
    ]
  }
]
```


---

## `GET listar/conta/:situacao` — Listar Contas Bancárias

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
"codigo_conta": "9",
"codigo_agencia": "99",
"codigo_banco":	"999",
"descricao_banco": "HINOVA BANK",
"hinova_bank": "SIM",
"situacao":	"ATIVO"
}
```


---

## `GET listar/situacao-boleto/:situacao` — Listar Situação

Busca as situações de boletos disponíveis


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | Number | sim | A situação das situações de boleto a serem retornadas. Pode ser: ativo, inativo, todos |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_situacaoboleto": "9",
"descricao": "BAIXADO",
"pago": "SIM"
}
```


---

## `GET listar/tipo-boleto/:situacao` — Listar tipo

Lista os tipos de boletos cadastrados na base


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação dos tipos de boleto a serem retornados, se a situação for "todos", serão retornados todos os tipos não excluídos, independente de estarem ativos ou inativos |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_tipo_boleto": "9",
"descricao": "FECHAMENTO",
"boleto_adesao": "NÃO"
}
```


---

## `GET tipo-cobranca-recorrente/listar/:situacao` — Listar Tipo Cobr. Recorrente

Lista os tipos de cobranças disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação dos tipos a serem retornadas, se a situação for "todos", serão retornados todos os tipos não excluídos, independente de estarem ativos ou inativos |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_tipocobrancarecorrente": "9",
"descricao": "BOLETO / CARNÊ",
"situacao": "ATIVO"
}
```


---

## `GET tipo-envio-boleto/listar/:situacao` — Listar tipo do envio do boleto

Lista os tipos de envio de boletos cadastrados na base


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação dos tipos de envio de boleto a serem retornados, se a situação for "todos", serão retornados todos os tipos não excluídos, independente de estarem ativos ou inativos |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
"codigo_tipoenvioboleto": "9",
"descricao": "POSTAGEM NOS CORREIOS",
"situacao": "ATIVO"
}
```


---
