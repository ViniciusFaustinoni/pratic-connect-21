
## Pontos preliminares confirmados

**1. Endpoint já é produção.**
`rastreadores_config_plataformas` para `rede_veiculos`:
- `ambiente_atual = producao`
- `api_url_producao = https://integracao.redeveiculos.com/api/v2/prod`
- A edge usa `${baseUrl}/vincularClienteVeiculo/` → resolve para `/api/v2/prod/vincularClienteVeiculo/`. ✅ Nada a alterar aqui.

**2. Tipo do veículo — fonte canônica encontrada.**
A tabela `veiculos` não guarda tipo, mas `marcas_modelos.tipo_veiculo` é a fonte canônica (regra de memória já estabelecida).
Para KPJ4994: JOIN por marca+modelo retorna `tipo_veiculo = 'carro'` → mapear para `'CARRO'` (uppercase) exigido pela Rede.

Mapeamento `tipo_veiculo` local → enum Rede:
- `carro` → `CARRO`
- `moto` → `MOTO`
- `caminhao` → `CAMINHAO`
- `onibus` → `ONIBUS`
- fallback: `CARRO` (com `console.warn [tipo-fallback]` para rastreabilidade)

Outros valores do enum Rede (`JETSKI`, `BARCO`, `BICICLETA`, `TRATOR`, `RETRO`, `PET`, `PESSOAL`) não têm correspondente em `marcas_modelos.tipo_veiculo` hoje — ficam como TODO futuro.

---

## Etapa A — Reestruturar payload na edge `rede-veiculos-vincular-cliente`

Trocar o bloco "6. Montar payload" + "7. Chamar API" pelo formato que a doc oficial exige: tudo aninhado dentro de `dados`, sem campos duplicados na raiz dos objetos `equipamento`/`veiculo`/`cliente`.

**Novo payload (estrutura oficial v2):**

```json
{
  "equipamento": {
    "dados": {
      "imei": "354522186314659",
      "localInstalacao": "painel",
      "possuiBloqueio": false
    }
  },
  "veiculo": {
    "dados": {
      "tipo": "CARRO",
      "marca": "RENAULT",
      "modelo": "DUSTER DYNAMIQUE 1.6 FLEX 16V MEC.",
      "placa": "KPJ4994",
      "cor": "Prata",
      "ano": "2013",
      "chassi": "93YHSR6P5DJ617772",
      "renavam": "<renavam ou omitir>"
    }
  },
  "cliente": {
    "dados": {
      "cpfCnpj": "00337172730",
      "nome": "ANDERSON DA SILVA ESTEVES",
      "celular": "<telefone limpo>",
      "email": "<email>",
      "endereco": {
        "cep": "...",
        "logradouro": "...",
        "numero": "...",
        "bairro": "...",
        "cidade": "...",
        "uf": "..."
      }
    }
  },
  "permissoes": {
    "acessoWeb": true,
    "pushNotifications": true,
    "alertaVelocidade": true,
    "alertaCercaVirtual": true,
    "alertaIgnicao": true
  }
}
```

**Envio (mantém urlencoded conforme doc):**
```ts
const formBody = new URLSearchParams();
formBody.append('json', JSON.stringify(payload));
// NÃO duplicar cpfCnpj/imei/placa na raiz do form — a doc não pede
```

**Mudanças cirúrgicas na edge:**
1. Remover `cpfCnpj` e `imei` do nível raiz do objeto `payload` (linhas 232–235).
2. Aninhar `equipamento`, `veiculo`, `cliente` dentro de `{ dados: {...} }`.
3. Buscar `tipo_veiculo` via JOIN com `marcas_modelos` (marca+modelo), mapear para uppercase com fallback `CARRO`.
4. Atualizar `mapTipoVeiculo` para receber `tipoCanonico` e devolver enum Rede.
5. Remover `formBody.append('cpfCnpj'/'imei'/'placa')` — manter apenas `json`.
6. `permissoes` segue dentro do payload (não está documentado como obrigatório, mas a edge já usa — manter por compatibilidade).

**Antes de disparar:** a edge ainda NÃO será chamada. Eu mostro o request body montado (via `console.log` + execução dry-run) e você confirma antes do disparo real para o Anderson.

---

## Etapa B — Disparo controlado do Anderson/KPJ4994 (após confirmação)

Após você validar o payload reestruturado:

1. Chamar `rede-veiculos-vincular-cliente` com:
   - `imei = 354522186314659`
   - `veiculoId = d53acb36-0e8c-4683-8537-0651c724d454`
   - `associadoId = 5f51682f-7be6-45c5-baf2-b695711ddf3a`
2. **Validações pós-chamada (3 trincas):**
   - `rede-veiculos-buscar-dispositivo` por IMEI → deve retornar KPJ4994 vinculado a Anderson
   - Consulta por CPF Anderson (`00337172730`) → deve listar KPJ4994
   - Consulta por CPF Gabriel (`15582970738`) → deve continuar vazio
3. Se sucesso: registrar memória `mem://logic/integrations/rede-veiculos-vincular-payload-v2-dados-aninhado` com o formato canônico e atualizar resolução do caso Anderson.
4. Se falhar: parar, reportar resposta crua, sem improvisar fix em cima de fix.

---

## Etapa C — Hardening da edge `efetivar-troca-titularidade` (deploy próprio, depois de A+B verdes)

Mantido como acordado: quando `rastreadores.status ≠ 'instalado'` mas `veiculo_id` está setado, enfileirar em `sga_sync_queue` com `etapa_parou = 'revisao_rastreador_estado_ambiguo'`, `status = 'falha_permanente'` (Softruck + Rede simétrico).

Sem batch retroativo (1 única troca efetivada no histórico).

---

## TODOs registrados (não bloqueiam este deploy)

- Mapear demais tipos do enum Rede (`JETSKI`, `BARCO`, `BICICLETA`, `TRATOR`, `RETRO`, `PET`, `PESSOAL`) quando aparecerem em `marcas_modelos.tipo_veiculo`.
- Endpoint separado `/atualizarDadosCliente/` para casos de cliente já cadastrado precisando de update (regra da doc: vincular ignora dados de cliente preexistente).

---

## Ordem de execução

1. Etapa A (reestruturar payload) — **deploy + dry-run com log do body**
2. **Pausa para sua confirmação** do payload exato
3. Etapa B (disparo Anderson + 3 trincas de validação)
4. Etapa C (hardening edge troca) — deploy próprio depois
