# Rede Veículos — cliente

## POST /atualizarDadosCliente

**URL:** `{{$urlBase}}/atualizarDadosCliente/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{
   "cpfCnpjCliente":"",
   "cliente":{
      "dados":{
         "nome":"",
         "docInscMunEst":"",
         "telefone":"",
         "celular":"",
         "whatsapp":"",
         "emailContato":"",
         "emailAlertas":"",
         "cep":"",
         "enderecoCompleto":"",
         "bairro":"",
         "cidade":"",
         "uf":"",
         "observacoes":"Testando API"
      },
      "permissoes":{
         "acessoWeb":"S",
         "alterarDadosNaoAutorizado":"S",
         "pushNotificationsGeral":"S",
         "pushNotificationsBateria":"N",
         "alertasPlataformaGeral":"S",
         "alertasPlataformaBateria":"N",
         "alertasPlataformaExclusao":"N",
         "acessoHistoricoSomente24h":"N"
      }
   }
}
```

**Notas / mínimo obrigatório:**

```
É obrigatório informar o CPF/CNPJ do cliente.
PS1. Não é necessário informar todos os dados para atualização, somente o que será modificado é requerido.
PS2. Não é permitido alterar o CPF/CNPJ.
Permissões default: (Modifique com cautela)
"permissoes":{
      "acessoWeb":"S",
      "alterarDadosNaoAutorizado":"S",
      "pushNotificationsGeral":"S",
      "pushNotificationsBateria":"N",
      "alertasPlataformaGeral":"S",
      "alertasPlataformaBateria":"N",
      "alertasPlataformaExclusao":"N",
      "acessoHistoricoSomente24h":"N"
}
```


**Resposta 200:**
```json
{
    "error": "false",
    "message": "Dados do cliente atualizados com sucesso"
}
```

---

## POST /preCadastroCliente

**URL:** `{{$urlBase}}/preCadastroCliente/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{
    "acaoPreCadastro": "inserir, alterar ou excluir",
    "cliente": {
        "dados": {
            "cpfCnpj": "",
            "nome": "",
            "docInscMunEst": "",
            "telefone": "",
            "celular": "",
            "whatsapp": "",
            "emailContato": "",
            "emailAlertas": "",
            "cep": "",
            "enderecoCompleto": "",
            "bairro": "",
            "cidade": "",
            "uf": "",
            "observacoes": ""
        },
        "permissoes": {
            "acessoWeb": "S",
            "alterarDadosNaoAutorizado": "S",
            "pushNotificationsGeral": "S",
            "pushNotificationsBateria": "N",
            "alertasPlataformaGeral": "S",
            "alertasPlataformaBateria": "N",
            "alertasPlataformaExclusao": "N",
            "acessoHistoricoSomente24h": "N"
        }
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

## POST /ativarCliente

**URL:** `{{$urlBase}}/ativarCliente/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{"cpfCnpjCliente":""}
```

**Notas / mínimo obrigatório:**

```
É obrigatório informar o CPF/CNPJ do cliente.
```


**Resposta 200:**
```json
{
    "error": "false",
    "message": "O cliente foi marcado como ATIVO"
}
```

---

## POST /inativarCliente

**URL:** `{{$urlBase}}/inativarCliente/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{"cpfCnpjCliente":""}
```

**Notas / mínimo obrigatório:**

```
É obrigatório informar o CPF/CNPJ do cliente.
```


**Resposta 200:**
```json
{
    "error": "false",
    "message": "O cliente foi marcado como INATIVO"
}
```

---

## POST /obterStatusCliente

**URL:** `{{$urlBase}}/obterStatusCliente/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{"cpfCnpjCliente":""}
```

**Notas / mínimo obrigatório:**

```
É obrigatório informar o CPF/CNPJ do cliente.
```


**Resposta 200:**
```json
{
    "nome": "Joao das Couves",
    "cpfCnpj": "11638319723",
    "ativo": "S"
}
```

---

## POST /obterDadosCliente

**URL:** `{{$urlBase}}/obterDadosCliente/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{"cpfCnpjCliente":""}
```

**Notas / mínimo obrigatório:**

```
É obrigatório informar o CPF/CNPJ do cliente.
```


**Resposta 200:**
```json
{
    "nome": "Joao Das Couves",
    "cpfCnpj": "11638319723",
    "rg": "08214273-0 DETRAN/RJ",
    "email": "analistapb@yahoo.com",
    "emailAlertas": "webmaster@redeveiculos.com",
    "telefone": "2139424252",
    "celular": "21964264945",
    "whatsapp": "21964264945",
    "cep": "20941-150",
    "endereco": "Rua Das Margaridas, 300 Casa 1",
    "bairro": "Sao Cristovao",
    "cidade": "Rio De Janeiro",
    "estado": "RJ",
    "ativo": "S"
}
```

---

## POST /permitirAcessoSistema

**URL:** `{{$urlBase}}/permitirAcessoSistema/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{"cpfCnpjCliente":""}
```

**Notas / mínimo obrigatório:**

```
É obrigatório informar o CPF/CNPJ do cliente.
```


**Resposta 200:**
```json
{
    "error": "false",
    "message": "Foi PERMITIDO o acesso ao sistema para este cliente"
}
```

---

## POST /removerAcessoSistema

**URL:** `{{$urlBase}}/removerAcessoSistema/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{"cpfCnpjCliente":""}
```

**Notas / mínimo obrigatório:**

```
É obrigatório informar o CPF/CNPJ do cliente.
```


**Resposta 200:**
```json
{
    "error": "false",
    "message": "Foi REMOVIDO o acesso ao sistema para este cliente"
}
```

---

## POST /redefinirSenhaCliente

**URL:** `{{$urlBase}}/redefinirSenhaCliente/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{"cpfCnpjCliente":""}
```

**Notas / mínimo obrigatório:**

```
É obrigatório informar o CPF/CNPJ do cliente.
```


**Resposta 200:**
```json
{
    "error": "false",
    "message": "A senha do cliente foi redefinida para a senha padrão"
}
```

---
