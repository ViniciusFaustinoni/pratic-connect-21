# Rede Veículos — operacional

## POST /obterUltimaPosicaoValida

**URL:** `{{$urlBase}}/obterUltimaPosicaoValida/`

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
    "placa": "RDV0001",
    "chassi": "935SLYFYYEB570000",
    "ignicaoLigada": "S",
    "voltagemBateria": "14.1",
    "movimento": "S",
    "bloqueado": "N",
    "statusGPRS": "ONLINE",
    "dataGPRS": "2021-04-23 23:29:59",
    "statusGPS": "FIXED",
    "dataGPS": "2021-04-23 23:30:03",
    "satelites": "12",
    "velocidade": "59",
    "latlon": "-22.902362|-43.57716"
}
```

---

## POST /obterLinkCompartilhamento

**URL:** `{{$urlBase}}/obterLinkCompartilhamento`

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
    "message": [
        {
            "1": "https://tinyurl.com/2qyfz2c3"
        }
    ]
}
```

---

## POST /acionamentoRouboFurto

**URL:** `{{$urlBase}}/acionamentoRouboFurto/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{"chassi":"","placa":"","imei":"","cpfCnpjCliente":"","naturezaAcionamento":"","endereco":"","referencia":"","boletimOcorrencia":"","dataOcorrencia":"","bloqueioAcessoCliente":""}
```

**Notas / mínimo obrigatório:**

```
É obrigatório informar o (CHASSI e/ou PLACA do veículo e/ou IMEI do equipamento) e o CPF/CNPJ do cliente.
O campo 'naturezaAcionamento' não é obrigatório e o valor padrão é 'R'. Valores aceitos: R(oubo) e F(urto)
O campo 'endereco' não é obrigatório.
O campo 'referencia' não é obrigatório.
O campo 'boletimOcorrencia' não é obrigatório.
O campo 'dataOcorrencia' não é obrigatório e o valor padrão é a data/hora da chamada da API (Horário de Brasília) Formato de data esperada: AAAA-MM-DD HH:MM:SS (2023-02-17 14:59:59)
O campo 'bloqueioAcessoCliente' não é obrigatório e o valor padrão é 'S'. Valores aceitos: S(im) e N(ão)
```


**Resposta 200:**
```json
{
    "error": "false",
    "message": [
        {
            "1": "https://tinyurl.com/2jqy5c4v"
        }
    ]
}
```

---
