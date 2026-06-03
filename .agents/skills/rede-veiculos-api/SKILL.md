---
name: rede-veiculos-api
description: API REST v2 da Rede Veículos (plataforma de rastreadores). Use ao mexer em edges `rede-veiculos-*`, na sincronização de cliente/veículo/equipamento da Rede, vínculo/desvinculo de IMEI, comandos de bloqueio (acionamentoRouboFurto), consulta de posição/status, ou em qualquer chamada direta `integracao.redeveiculos.com/api/v2/*`. Cobre os 22 endpoints oficiais com payloads, exemplos e respostas.
---

# Rede Veículos API v2

Documentação oficial: https://documenter.getpostman.com/view/15619634/TzRLmr9r

## Base URLs

- Sandbox: `https://integracao.redeveiculos.com/api/v2/sandbox/`
- Produção: `https://integracao.redeveiculos.com/api/v2/prod/`

Sempre via variável de ambiente — nunca hardcode.

## Autenticação

Bearer fixo por integrador no header:

```
Authorization: Bearer <REDE_VEICULOS_API_TOKEN>
```

Secret canônico do projeto: `REDE_VEICULOS_API_TOKEN`. Sem refresh; token é estável.

## Formato dos requests (peculiar — leia)

**Todos os 22 endpoints são `POST` com `application/x-www-form-urlencoded`** e o corpo inteiro vai numa **única chave `json` contendo o JSON stringificado**:

```bash
curl -X POST 'https://integracao.redeveiculos.com/api/v2/prod/vincularClienteVeiculo/' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'json={"equipamento":{...},"veiculo":{...},"cliente":{...}}'
```

Em Deno/edge function:

```ts
const body = new URLSearchParams();
body.set('json', JSON.stringify(payload));

const res = await fetch(`${BASE_URL}vincularClienteVeiculo/`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${Deno.env.get('REDE_VEICULOS_API_TOKEN')}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body,
});
const data = await res.json();
if (data.error === 'true') throw new Error(data.message);
```

⚠️ **NÃO** enviar `Content-Type: application/json` nem JSON puro no body — a API rejeita silenciosamente.

## Formato das respostas

Sempre o mesmo envelope:

```json
{ "error": "false", "message": "..." }
```

- `error` é **STRING** (`"false"` / `"true"`), nunca boolean. Comparar com string: `data.error === 'false'`.
- Endpoints "obter*" trazem campos adicionais junto do envelope.

## Endpoints (22 total)

Lista completa em [`references/_index.md`](./references/_index.md). Detalhe por grupo funcional:

- [`vinculo.md`](./references/vinculo.md) — `vincularClienteVeiculo`, `desvincularClienteVeiculo`
- [`cliente.md`](./references/cliente.md) — `atualizarDadosCliente`, `preCadastroCliente`, `ativarCliente`, `inativarCliente`, `obterStatusCliente`, `obterDadosCliente`, `permitirAcessoSistema`, `removerAcessoSistema`, `redefinirSenhaCliente`
- [`veiculo.md`](./references/veiculo.md) — `atualizarDadosVeiculo`, `preCadastroVeiculo`, `ativarVeiculo`, `inativarVeiculo`, `informarVeiculoAdimplente`, `informarVeiculoInadimplente`, `obterStatusVeiculo`, `obterDadosVeiculo`
- [`operacional.md`](./references/operacional.md) — `obterUltimaPosicaoValida`, `obterLinkCompartilhamento`, `acionamentoRouboFurto`

Coleção Postman bruta em [`assets/collection.json`](./assets/collection.json) (48 KB) para fallback.

## Convenções do projeto

- **Cliente compartilhado:** sempre que houver, usar `supabase/functions/_shared/rede-veiculos-client.ts`. Se ainda não existir um helper, criar antes de chamar `fetch` direto em mais de uma edge.
- **Edges canônicas:**
  - `rede-veiculos-backfill-veiculos` — sincronização em lote.
  - `rede-veiculos-atualizar-equipamento` — corrige `localInstalacao` pós-vínculo (ver memória `rede-atualizar-local-instalacao`).
  - Cron de desvínculo bidirecional Soft/Rede (ver memória `softtruck-desvinculo-bidirecional`).
- **Identificador local:** `veiculos.rede_veiculos_veiculo_id` é a chave canônica para chamadas pós-vínculo. Sem ela, `atualizarDadosEquipamento` precisa ser corrigido **manualmente** no painel da Rede.
- **Tri-fonte de rastreador:** quando Softruck `found=true` em outro veículo, ainda assim consultar Rede para confirmar pertencimento ao alvo (memória `tri-fonte-rastreador-prefere-rede-quando-softruck-em-outro-veiculo`).
- **Vínculo único:** ao receber 404 da Rede em consultas, considerar o equipamento desvinculado do nosso lado (memória `rastreador-vinculo-preservacao`).

## Pitfalls upstream (decorar)

1. **`error` é string** — `if (data.error === 'true')` para detectar falha.
2. **Body é form-urlencoded com chave `json`** — não JSON puro.
3. **`vincularClienteVeiculo` ignora dados do cliente se o CPF/CNPJ já existe**. Para atualizar, chamar `atualizarDadosCliente` separadamente após o vínculo.
4. **Booleans são "S"/"N"** em todos os campos (`acessoWeb`, `possuiBloqueio`, `ZeroKM`, `pushNotificationsGeral`, etc).
5. **Tipos de veículo permitidos** (enum fechado em `tipo`): `CARRO`, `ONIBUS`, `MOTO`, `CAMINHAO`, `JETSKI`, `BARCO`, `BICICLETA`, `TRATOR`, `RETRO`, `PET`, `PESSOAL`. Mapear `marcas_modelos.tipo_veiculo` → enum antes de enviar.
6. **Defaults sensíveis** de `permissoes` e `equipamento` estão marcados "Modifique com cautela" na doc oficial — não inventar valores; usar os defaults exatos a menos que haja requisito de produto.
7. **0KM:** campo `ZeroKM: "S"` (string). Pode-se enviar chassi como identificador principal quando placa ainda é provisória.
8. **Identificação em endpoints de update/desvínculo:** aceita **CHASSI e/ou PLACA do veículo e/ou IMEI** + **CPF/CNPJ do cliente**. Pelo menos um identificador do veículo é obrigatório.
9. **`localInstalacao`** só é editável pós-vínculo via `atualizarDadosVeiculo` (a Postman call mistura o campo na seção `equipamento.dados`) — atenção ao formato exato em [`veiculo.md`](./references/veiculo.md).
10. **`acionamentoRouboFurto` é destrutivo** (bloqueia veículo, gera evento). Sempre passar por gate de autorização do nosso lado (`enviar-comando-rastreador` já faz).
11. **Sem paginação nem listagem geral.** Tudo é por identificador. Para "ver tudo", iterar do nosso DB.

## Template canônico de chamada

```ts
// supabase/functions/_shared/rede-veiculos-client.ts (esqueleto canônico)
const BASE_URL = Deno.env.get('REDE_VEICULOS_API_URL')
  ?? 'https://integracao.redeveiculos.com/api/v2/prod/';
const TOKEN = Deno.env.get('REDE_VEICULOS_API_TOKEN');

export async function callRedeVeiculos<T = any>(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<T> {
  if (!TOKEN) throw new Error('REDE_VEICULOS_API_TOKEN ausente');
  const body = new URLSearchParams({ json: JSON.stringify(payload) });
  const res = await fetch(`${BASE_URL}${endpoint}/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json().catch(() => ({ error: 'true', message: 'invalid_json' }));
  if (data.error === 'true') {
    throw new Error(`[rede-veiculos:${endpoint}] ${data.message}`);
  }
  return data as T;
}
```
