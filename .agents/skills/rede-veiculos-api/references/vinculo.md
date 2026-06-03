# Rede Veículos — vinculo

## POST /vincularClienteVeiculo

**URL:** `{{$urlBase}}/vincularClienteVeiculo/`

**Auth:** `Authorization: Bearer <REDE_VEICULOS_API_TOKEN>`

**Content-Type:** `application/x-www-form-urlencoded` (payload na chave `json`)

**Body (template completo):**
```json
{
       "equipamento":{
          "dados":{
             "imei":"",
             "ignicaoVirtual":"N",
             "positivoPosChave":"N",
             "possuiBloqueio":"N",
             "bloqueioLiberadoCliente":"N",
             "localInstalacao":""
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
             "valorFipe":"",
             "ZeroKM": "N"
          }
       },
       "cliente":{
          "dados":{
            "cpfCnpj":"",
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
             "observacoes":""
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
Json mínimo com campos obrigatórios:
{
   "equipamento":{
      "dados":{
         "imei":""
      }
   },
   "veiculo":{
      "dados":{
         "tipo":"",
         "marca":"",
         "modelo":"",
         "placa":"",
         "cor":"",
         "ano":""
      }
   },
   "cliente":{
      "dados":{
         "cpfCnpj":"",
         "nome":""
      }
   }
}
Permissões default de cliente: (Modifique com cautela)
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
Opções default de equipamento: (Modifique com cautela)
"equipamento": {
        "dados": {
            "ignicaoVirtual": "N",
            "positivoPosChave": "N",
            "possuiBloqueio": "N",
            "bloqueioLiberadoCliente": "N"
        }
}
Opções default de veículo: (Modifique com cautela)
"ZeroKM": "N"
PS. Caso o CPF/CNPJ informado já esteja cadastrado, os dados de veículo e equipamento serão vinculados ao CPF/CNPJ e os dados informados do cliente serão ignorados, ou seja, não serão atualizados. Utilize a rota /atualizarDadosCliente para este fim.
```


**Resposta 200:**
```json
{
    "error": "false",
    "message": "Vinculo realizado com sucesso! PLACA: KKK9990 | IMEI: 865011030294129 | CPF/CNPJ: 11638319723"
}
```

---

## POST /desvincularClienteVeiculo

**URL:** `{{$urlBase}}/desvincularClienteVeiculo/`

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
    "message": "Desvinculo realizado com sucesso!"
}
```

---
