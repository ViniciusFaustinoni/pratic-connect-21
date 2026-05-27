## Objetivo
Corrigir o envio de CEP para a API Rede Veículos (formato obrigatório `XXXXX-XXX`), endurecer comportamento com CEP inválido, e reprocessar o vínculo do Anderson (KPJ4994).

## Callers afetados (confirmado via `rg`)
Apenas 2 edges enviam CEP no payload da Rede:

1. `supabase/functions/rede-veiculos-vincular-cliente/index.ts:314` — envia `cep` cru sem hífen no `clienteDados`.
2. `supabase/functions/rede-veiculos-atualizar-cliente/index.ts:229` — mesma sanitização sem formatação.

Demais edges Rede (`desvincular-cliente`, `informar-adimplente/inadimplente`, `ativar/inativar-cliente-completo`, etc.) **não enviam CEP** — fora de escopo.

## Mudanças

### 1. Helper compartilhado (inline em cada edge, não vamos criar shared yet)
```ts
function formatarCepRede(cepRaw: string | null | undefined, ctx: { associadoId: string; caller: string }): string {
  const digits = (cepRaw || '').replace(/\D/g, '');
  if (digits.length !== 8) {
    console.warn('[REDE_CEP_INVALIDO]', { ...ctx, cepRaw, digits });
    throw new Error(`CEP_INVALIDO: associado ${ctx.associadoId} tem CEP "${cepRaw}" inválido (esperado 8 dígitos). Corrija no cadastro antes de sincronizar com a Rede.`);
  }
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
```

**Decisão (conforme recomendação aprovada): abortar com erro identificável** — CEP inválido vira 400 visível, não falha silenciosa. A edge devolve `{ success:false, code:'CEP_INVALIDO', message }` (HTTP 400) para que UI/cron/troca de titularidade tratem como erro cadastral acionável.

### 2. `rede-veiculos-vincular-cliente/index.ts` (linha ~314)
Substituir:
```ts
if (associado.cep) clienteDados.cep = associado.cep.replace(/\D/g, '');
```
Por chamada ao helper + try/catch que devolve 400 com `code:'CEP_INVALIDO'` antes de tentar `POST /clientes`. Se `associado.cep` for null/vazio, omitir o campo (comportamento atual da Rede aceita ausência; só rejeita formato inválido).

### 3. `rede-veiculos-atualizar-cliente/index.ts` (linha ~229)
Mesma troca dentro de `camposAlterados.cep ?? associado.cep`. Se nenhum CEP, omitir do PATCH; se presente porém inválido, abortar com 400 `CEP_INVALIDO`.

### 4. Sem mudanças em `desvincular-cliente` (CEP não é enviado lá).

### 5. Reprocessar Anderson após deploy
- Confirmar `associados.cep` do Anderson via `supabase--read_query` (id `5f51682f-7be6-45c5-baf2-b695711ddf3a`). Se ≠8 dígitos, instrução para o operador corrigir antes; se válido, prosseguir.
- Chamar `supabase--curl_edge_functions` POST `/rede-veiculos-vincular-cliente` com:
  ```json
  {"imei":"354522186314659","veiculoId":"d53acb36-0e8c-4683-8537-0651c724d454","associadoId":"5f51682f-7be6-45c5-baf2-b695711ddf3a"}
  ```
- Coletar via `supabase--edge_function_logs rede-veiculos-vincular-cliente`:
  - Payload final enviado à Rede (com CEP `23094-140`)
  - Resposta crua (`idCliente`, `idVeiculo`, `idEquipamento`)
- Verificar persistência via SQL:
  ```sql
  select rede_veiculos_cliente_id, rede_veiculos_veiculo_id, updated_at
  from veiculos where id='d53acb36-0e8c-4683-8537-0651c724d454';
  select plataforma_device_id, plataforma, updated_at
  from rastreadores where imei='354522186314659';
  ```

## Fora de escopo (mantido do plano anterior, não nesta rodada)
- Itens 2/3/4/6 do plano anterior (override de CPF no desvincular, branch 6.3 em `efetivar-troca-titularidade`, retry no `cron-sga-retry`, audit de callers obsoletos com payload flat).

## Critério de sucesso
- Anderson com `rede_veiculos_cliente_id` e `rede_veiculos_veiculo_id` preenchidos.
- `rastreadores.plataforma_device_id` preenchido para IMEI `354522186314659`.
- Log mostrando CEP no formato `23094-140` no payload outgoing.
- Tentativa futura com CEP inválido em qualquer dos 2 callers retorna 400 `CEP_INVALIDO` em vez de erro genérico da Rede.
