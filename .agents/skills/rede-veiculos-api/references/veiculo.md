# Rede Veículos — veiculo

## POST /atualizarDadosVeiculo

**URL:** `{{$urlBase}}/atualizarDadosVeiculo/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{
   "chassi":"",
   "placa":"",
   "imei":"",
   "cpfCnpjCliente":"",
   "equipamento":{
      "dados":{
         "ignicaoVirtual":"N",
         "positivoPosChave":"N",
         "possuiBloqueio":"N",
         "bloqueioLiberadoCliente":"N",
         "localInstalacao":"Soleira esquerda"
      }
   },
   "veiculo":{
      "dados":{
         "tipo":"",
         "marca":"",
         "modelo":"",
         "placa":"",
         "cor":"",
         "ano":"",
         "chassi":"",
         "renavam":"",
         "codigoFipe":"",
         "valorFipe":""
      }
   }
}
```

**Notas / mínimo obrigatório:**

```
É obrigatório informar o (CHASSI e/ou PLACA do veículo e/ou IMEI do equipamento) e o CPF/CNPJ do cliente.
PS. Não é necessário informar todos os dados para atualização, somente o que será modificado é requerido.
Tipos permitidos:
CARRO
ONIBUS
MOTO
CAMINHAO
JETSKI
BARCO
BICICLETA
TRATOR
RETRO
PET
PESSOAL
```


**Resposta 200:**
```json
{
    "error": "false",
    "message": "Dados do veículo atualizados com sucesso"
}
```

---

## POST /preCadastroVeiculo

**URL:** `{{$urlBase}}/preCadastroVeiculo/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{
    "acaoPreCadastro": "inserir, alterar ou excluir",
    "dados": {
        "tipo": "",
        "marca": "",
        "modelo": "",
        "placa": "",
        "cor": "",
        "ano": "",
        "chassi": "",
        "renavam": "",
        "codigoFipe": "",
        "valorFipe": ""
    }
}
```


**Resposta 200:**
```json
{
    "error": "false",
    "message": "Dados do veículo atualizados com sucesso"
}
```

---

## POST /ativarVeiculo

**URL:** `{{$urlBase}}/ativarVeiculo/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{"chassi":"","placa":"","imei":"","cpfCnpjCliente":""}
```

**Notas / mínimo obrigatório:**

```
É obrigatório informar o (CHASSI e/ou PLACA do veículo e/ou IMEI do equipamento) e o CPF/CNPJ do cliente.
```


**Resposta 200:**
```json
{
    "error": "false",
    "message": "O veículo foi marcado como ATIVO"
}
```

---

## POST /inativarVeiculo

**URL:** `{{$urlBase}}/inativarVeiculo/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{"chassi":"","placa":"","imei":"","cpfCnpjCliente":""}
```

**Notas / mínimo obrigatório:**

```
É obrigatório informar o (CHASSI e/ou PLACA do veículo e/ou IMEI do equipamento) e o CPF/CNPJ do cliente.
```


**Resposta 200:**
```json
{
    "error": "false",
    "message": "O veículo foi marcado como INATIVO"
}
```

---

## POST /informarVeiculoAdimplente

**URL:** `{{$urlBase}}/informarVeiculoAdimplente/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{"chassi":"","placa":"","imei":"","cpfCnpjCliente":""}
```

**Notas / mínimo obrigatório:**

```
É obrigatório informar o (CHASSI e/ou PLACA do veículo e/ou IMEI do equipamento) e o CPF/CNPJ do cliente.
```


**Resposta 200:**
```json
{
    "error": "false",
    "message": "O veículo foi marcado como ADIMPLENTE"
}
```

---

## POST /informarVeiculoInadimplente

**URL:** `{{$urlBase}}/informarVeiculoInadimplente/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{"chassi":"","placa":"","imei":"","cpfCnpjCliente":""}
```

**Notas / mínimo obrigatório:**

```
É obrigatório informar o (CHASSI e/ou PLACA do veículo e/ou IMEI do equipamento) e o CPF/CNPJ do cliente.
```


**Resposta 200:**
```json
{
    "error": "false",
    "message": "O veículo foi marcado como INADIMPLENTE"
}
```

---

## POST /obterStatusVeiculo

**URL:** `{{$urlBase}}/obterStatusVeiculo/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{"chassi":"","placa":"","imei":"","cpfCnpjCliente":""}
```

**Notas / mínimo obrigatório:**

```
É obrigatório informar o (CHASSI e/ou PLACA do veículo e/ou IMEI do equipamento) e o CPF/CNPJ do cliente.
```


**Resposta 200:**
```json
{
    "imei": "865011032269251",
    "ativo": "N",
    "dataInativo": "2021-06-03 22:10:48",
    "inadimplente": "S",
    "dataInadimplente": "2021-06-03 16:58:30"
}
```

---

## POST /obterDadosVeiculo

**URL:** `{{$urlBase}}/obterDadosVeiculo/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{"chassi":"","placa":"","imei":"","cpfCnpjCliente":""}
```

**Notas / mínimo obrigatório:**

```
É obrigatório informar o (CHASSI e/ou PLACA do veículo e/ou IMEI do equipamento) e o CPF/CNPJ do cliente.
```


**Resposta 200:**
```json
{
    "imei": "865011032269251",
    "tipo": "CARRO",
    "marca": "Fiat",
    "modelo": "Toro",
    "placa": "KKK9990",
    "cor": "Azul",
    "ano": "2021",
    "chassi": "935SLYFYYEB570001",
    "renavam": "00881549911",
    "codigoFipe": "123456-0",
    "valorFipe": "10000.09",
    "ignicaoVirtual": "N",
    "positivoPosChave": "N",
    "possuiBloqueio": "N",
    "bloqueioLiberadoCliente": "N",
    "odometro": "56901.19"
}
```

---
