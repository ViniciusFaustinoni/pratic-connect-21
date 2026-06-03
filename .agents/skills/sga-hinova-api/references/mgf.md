# MGF (12 endpoints)

Base URL: `https://api.hinova.com.br/api/sga/v2`. Todos os endpoints (exceto `/usuario/autenticar`) exigem header `Authorization: Bearer <token_usuario>`.

---

## `GET listar/conta/:situacao` — Listar conta bancária

Retorna contas bancárias de acordo com as permissões do usuário.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Ativo, inativo, todos. Define qual a situação das contas bancárias a serem retornados, se a situação for "todos", serão retornados todas as contas bancárias não excluídos, independente de estarem ativos ou inativos |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
    "codigo_conta": "9",
    "codigo_agencia": "9999",
    "codigo_banco": "9",
    "descricao_banco": "NOME BANCO",
    "apelido": "APELIDO CONTA",
    "hinova_bank": "SIM",
    "situacao": "ATIVO"
}
```


---

## `GET mgf-caixa/listar/:situacao` — 

Lista os caixas de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação dos caixas a serem retornados, se a situação for "todos", serão retornados todos os caixas, independente de estarem ativos ou inativos |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
    {
        "codigo_mgfcaixalocal": "9",
        "descricao": "CAIXA LOCAL",
        "situacao": "ATIVO"
    },
    {
        "codigo_mgfcaixalocal": "99",
        "descricao": "CAIXA",
        "situacao": "ATIVO"
    }
]
```


---

## `GET mgf-conta-pagar/buscar/:codigo_ou_nota` — Buscar Conta Pagar

Busca uma conta a pagar pelo número da nota ou código do lançamento.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_ou_nota` | String | sim | Código do lançamento ou número da nota fiscal a ser consultado |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
    {
        "codigo_conta": "999",
        "numero_nota_fiscal": "999999",
        "data_nota_fiscal": "yyyy-mm-dd",
        "valor_nota": "999.99",
        "codigo_fornecedor": 9,
        "nome_fornecedor": "FORNECEDOR",
        "cpf_fornecedor": 999999999999999,
        "codigo_evento": 99,
        "codigo_voluntario": 9,
        "codigo_operacao": "9",
        "codigo_suboperacao": "9",
        "data_ocorrencia": "yyyy-mm-dd",
        "hora_ocorrencia": "99:99:99",
        "codigo_regional": 9,
        "codigo_cooperativa": 9,
        "codigo_departamento": "9",
        "codigo_veiculo": 9,
        "parcelas": [
            {
                "codigo_parcela": "99",
                "data_pagamento": 9,
                "data_vencimento": "yyyy-mm-dd",
                "codigo_situacao_parcela": "9",
                "situacao_parcela": "PAGA",
                "codigo_forma_pagamento": "9",
                "forma_pagamento": "NAO INFORMADO",
                "descricao_extrato": "DESCRIÇÃO",
                "codigo_banco": 999999999,
                "codigo_caixa_local": "9",
                "caixa_local": "CAIXA LOCAL",
                "numero_documento": "99999",
                "desconto": 9,
                "juros": 9,
                "multa": 9
            },
            {
                "codigo_parcela": "999",
                "data_pagamento": "yyyy-mm-dd",
                "data_vencimento": "yyyy-mm-dd",
                "codigo_situacao_parcela": "999",
                "situacao_parcela": "À PAGAR",
                "codigo_forma_pagamento": "9",
                "forma_pagamento": "NAO INFORMADO",
                "descricao_extrato": "DESCRIÇÃO",
                "codigo_banco": 9,
                "codigo_caixa_local": "9",
                "caixa_local": "CAIXA LOCAL",
                "numero_documento": "",
                "desconto": 9,
                "juros": 9,
                "multa": 9
            }
        ]
    }
]
```


---

## `GET mgf-conta-receber/buscar/:codigo_ou_nota` — Buscar Conta Receber

Busca uma conta a receber pelo número da nota ou código do lançamento.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_ou_nota` | String | sim | Código do lançamento ou número da nota fiscal a ser consultado |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
    {
        "codigo_conta": "999",
        "numero_nota_fiscal": "999999",
        "data_nota_fiscal": "yyyy-mm-dd",
        "valor_nota": "999.99",
        "codigo_cliente": 9,
        "nome_cliente": "FORNECEDOR",
        "cpf_cliente": 999999999999999,
        "codigo_evento": 99,
        "codigo_voluntario": 9,
        "codigo_operacao": "9",
        "codigo_suboperacao": "9",
        "data_ocorrencia": "yyyy-mm-dd",
        "hora_ocorrencia": "99:99:99",
        "codigo_regional": 9,
        "codigo_cooperativa": 9,
        "codigo_departamento": "9",
        "codigo_veiculo": 9,
        "parcelas": [
            {
                "codigo_parcela": "99",
                "data_pagamento": 9,
                "data_vencimento": "yyyy-mm-dd",
                "codigo_situacao_parcela": "9",
                "situacao_parcela": "PAGA",
                "codigo_forma_pagamento": "9",
                "forma_pagamento": "NAO INFORMADO",
                "descricao_extrato": "DESCRIÇÃO",
                "codigo_banco": 999999999,
                "codigo_caixa_local": "9",
                "caixa_local": "CAIXA LOCAL",
                "numero_documento": "99999",
                "desconto": 9,
                "juros": 9,
                "multa": 9
            },
            {
                "codigo_parcela": "999",
                "data_pagamento": "yyyy-mm-dd",
                "data_vencimento": "yyyy-mm-dd",
                "codigo_situacao_parcela": "999",
                "situacao_parcela": "À PAGAR",
                "codigo_forma_pagamento": "9",
                "forma_pagamento": "NAO INFORMADO",
                "descricao_extrato": "DESCRIÇÃO",
                "codigo_banco": 9,
                "codigo_caixa_local": "9",
                "caixa_local": "CAIXA LOCAL",
                "numero_documento": "",
                "desconto": 9,
                "juros": 9,
                "multa": 9
            }
        ]
    }
]
```


---

## `POST mgf-lancamento/alterar` — Alterar Lançamento

Altera um lançamento no MGF


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_lancamento` | Number | sim | Código do lançamento a ser alterado. |
| `codigo_evento` | Number | não | Código do evento vinculado ao lançamento. Caso seja enviado o código do associado ou veículo para alterar, este campo é obrigatório |
| `codigo_associado` | Number | não | Código do associado vinculado ao lançamento. Caso seja enviado o código do associado ou veículo para alterar, este campo é obrigatório |
| `codigo_veiculo` | Number | não | Código do associado vinculado ao lançamento. Caso seja enviado o código do associado ou veículo para alterar, este campo é obrigatório |
| `codigo_fornecedor` | Number | não | Código da sub-operação do lançamento. |
| `numero_nota_fiscal` | String | não | Número da nota fiscal relacionada ao lançamento. |
| `controle_interno` | String | não | Altera o número de controle interno do lançamento. |
| `alterar_parcelas` | Array | não | Array contendo os índices: parcela (qual parcela do lançamento está se referindo) codigo_situacao_parcela valor_parcela (valor da parcela. Formato "99,99". Opcional) valor_pagamento (valor pago da parcela. Formato "99,99". Opcional) data_vencimento (data de vencimento da parcela. Formato "dd/mm/yyyy". Opcional) data_pagamento (data de pagamento da parcela. Formato "dd/mm/yyyy". Opcional) codigo_caixa_local (Código do caixa local a ser alterado. Opcional) codigo_banco (Código do banco a ser alterado. Opcional) juros (opcional) multa (opcional) |


**Exemplo Retorno:**
```json
HTTP/1.1 207 OK

{
    "mensagem": "Alterado",
    "codigo_lancamento": "999"
}
```


---

## `POST mgf-lancamento/cadastrar` — Cadastrar Lançamento

Cadastra um lançamento no MGF


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `data_nota_fiscal` | String | sim | Data da Nota Fiscal. Formato dd/mm/yyyy |
| `numero_nota_fiscal` | Number | não | Número da Nota FIscal. |
| `valor_nota_fiscal` | Number | sim | Valor da Nota Fiscal. |
| `codigo_operacao` | Number | sim | Código da operação do lançamento. |
| `codigo_suboperacao` | Number | sim | Código da sub-operações do lançamento. |
| `data_pagamento` | String | não | Data do pagamento do Lançamento. Formato dd/mm/yyyy |
| `codigo_banco` | Number | não | Código do banco do lançamento. Necessário enviar código banco ou código caixa local |
| `codigo_caixa_local` | Number | não | Código do caixa local do lançamento. Necessário enviar código banco ou código caixa local |
| `parcelas` | Array | sim | Array contendo os índices: codigo_situacao_parcela valor_parcela (valor da parcela. Formato "99,99") data_vencimento (data de vencimento da parcela. Formato "dd/mm/yyyy") |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
    "mensagem": "OK",
    "codigo_lancamento": "9"
}
```


---

## `GET mgf-lancamento/excluir/:codigo_lancamento` — Excluir Lançamento

Exclui um lançamento do MGF.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_lancamento` | Number | sim | Código do lançamento a ser excluído. |


**Exemplo Retorno:**
```json
HTTP/1.1 207 OK
{
    "mensagem": "Alterado",
    "codigo_lancamento": "99"
}
```


---

## `POST mgf-lancamento/listar` — Listar Lançamento

Lista lançamentos do MGF


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer {token} } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `data_vencimento_inicial` | String | sim | Data da vencimento original. Formato dd/mm/yyyy |
| `data_vencimento_final` | String | sim | Data da vencimento final. Formato dd/mm/yyyy |
| `codigo_operacao` | Number | não | Código da operação do lançamento. |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
    "mensagem": "OK",
    "retorno": [
        {
            "codigo_lancamento": "279",
            "data_cadastro": "2021-01-06",
            "nota_fiscal": "2021",
            "valor_base": 5000,
            "quantidade_parcela": "3",
            "parcelas": [
                {
                    "suboperacao": "ASSOCIADOS",
                    "descricao": "PAGAMENTO DE INDENIZAÇÃO TOTAL",
                    "operacao": "SAÍDA",
                    "situacao": "À PAGAR",
                    "cliente": "",
                    "fornecedor": "",
                    "data_vencimento": "2021-02-10",
                    "parcela": "1",
                    "data_pagamento": "",
                    "codigo_banco": "",
                    "valor_parcela": "1666.66",
                    "valor_pago": "0.00",
                    "multa": "0.00",
                    "juros": "0.00",
                    "desconto": "0.00",
                    "codigo_caixa_local": "",
                    "caixa": ""
                },
                {
                    "suboperacao": "ASSOCIADOS",
                    "descricao": "PAGAMENTO DE INDENIZAÇÃO TOTAL",
                    "operacao": "SAÍDA",
                    "situacao": "À PAGAR",
                    "cliente": "",
                    "fornecedor": "",
                    "data_vencimento": "2021-03-10",
                    "parcela": "2",
                    "data_pagamento": "",
                    "codigo_banco": "",
                    "valor_parcela": "1666.67",
                    "valor_pago": "0.00",
                    "multa": "0.00",
                    "juros": "0.00",
                    "desconto": "0.00",
                    "codigo_caixa_local": "",
                    "caixa": ""
                }
            ]
        }
    ]
}
```


---

## `GET mgf-operacao/listar` — Listar Operações MGF

Lista as Operações do MGF


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
    {
        "codigo_operacao": "9",
        "descricao": "ENTRADA"
    },
    {
        "codigo_operacao": "99",
        "descricao": "SAIDA"
    }
]
```


---

## `GET mgf-saldo-caixa/buscar/:codigo_caixa` — Buscar Saldo Caixa

Retorna o saldo de um determinado caixa.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_caixa` | String | sim | Código do caixa a ser pesquisado o saldo. |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
    "mensagem": "OK",
    "codigo_caixa_local": "99",
    "caixa_local": "CAIXA LOCAL",
    "saldo_caixa": "99999.99",
    "data_referencia": "yyyy-mm-dd"
}
```


---

## `GET mgf-saldo-conta/buscar/:codigo_conta` — Buscar Saldo Conta

Retorna o saldo de uma determinada conta bancária.


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo_conta` | String | sim | Código da conta a ser pesquisado o saldo. |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
{
    "mensagem": "OK",
    "codigo_conta": "99",
    "conta": "CONTA",
    "saldo_conta": "99999.99",
    "data_referencia": "yyyy-mm-dd"
}
```


---

## `GET mgf-suboperacao/listar/:situacao` — Listar Sub-operação

Lista as sub-operações disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória


**Header:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Header` | json | sim | { "Content-Type": "application/json", "Authorization": Bearer token } |


**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | String | sim | Define qual a situação das sub-operações a serem retornadas, se a situação for "todos", serão retornadas todas as sub-operações, independente de estarem ativas ou inativas |


**Exemplo Retorno:**
```json
HTTP/1.1 200 OK
[
    {
        "codigo_mgfsuboperacao": "9",
        "descricao": "ENTRADAS MANUAIS",
        "situacao": "ATIVO"
    },
    {
        "codigo_mgfsuboperacao": "99",
        "descricao": "PROCESSAMENTO AUTOMÁTICO",
        "situacao": "INATIVO"
    }
]
```


---
