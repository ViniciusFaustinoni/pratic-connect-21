## Regra firmada

O sistema **nunca** envia situação ATIVO para o SGA — nem no cadastro, nem na ativação completa do contrato. Toda promoção para ATIVO é feita manualmente no painel SGA pela operação.

## Estado atual (problema)

1. `cadastrar_associado`: payload omite `codigo_situacao` → Hinova aplica default da regional, que é **ATIVO (1)**. Confirmado pelos logs do último associado (ERICO MORAES, 06/05).
2. `cadastrar_veiculo`: também omite (correto), mas:
3. `promover_situacao_veiculo`: quando `statusDestino === 'ativo'` e o veículo já existia, a função chama `/veiculo/alterar-situacao` com **código ATIVO**. Isso viola a nova regra.

Códigos confirmados: `1=ATIVO`, `3=PENDENTE`, `11=EXCLUÍDO`, `12=CANCELAMENTO`.

## Mudanças

### 1. `supabase/functions/_shared/hinova-client.ts`
Adicionar helper `alterarSituacaoAssociadoHinova(supabase, codigo_associado, codigo_situacao)`:
- Usa `hinovaFetch` (com retry de auth) para `GET /associado/alterar-situacao-para/:codigo_situacao/:codigo_associado`.
- Resolve `apiUrl` via `getHinovaSession(supabase)` (mesmo padrão de `buscarVeiculoPorPlaca`).
- Retorna `{ ok, status, raw, mensagem, errors }` no formato dos demais helpers.

### 2. `supabase/functions/sga-hinova-sync/index.ts`

**a) Após `cadastrar_associado` ok (linha ~665), forçar PENDENTE:**
```ts
// Forçar situação PENDENTE (Hinova entrega ATIVO por default — ativação é manual no SGA).
if (Number.isFinite(codigoSituacaoPendente) && codigoSituacaoPendente > 0) {
  try {
    const rs = await alterarSituacaoAssociadoHinova(
      supabase, codigoAssociadoHinova, codigoSituacaoPendente,
    );
    await logSync(_vid, _aid, 'alterar_situacao_associado',
      rs.ok ? 'success' : 'warning',
      { codigo_associado: codigoAssociadoHinova, codigo_situacao: codigoSituacaoPendente },
      rs.raw,
      rs.ok ? null : (rs.mensagem || rs.errors.join('; ') || `HTTP ${rs.status}`));
  } catch (e: any) {
    await logSync(_vid, _aid, 'alterar_situacao_associado', 'warning',
      { codigo_associado: codigoAssociadoHinova, codigo_situacao: codigoSituacaoPendente },
      null, String(e?.message || e));
  }
}
```
Usa warning (não error) para não bloquear o sync se a API rejeitar — associado já foi cadastrado.

**b) Veículo: fixar `codSituacao` SEMPRE em PENDENTE (linha 809):**
```ts
// Veículo entra SEMPRE como pendente — promoção é manual no SGA.
const codSituacao = codigoSituacaoPendente;
```

**c) Remover bloco "promoção pendente → ativo" (linhas 893–943):**
Substituir todo o bloco por um único log informativo quando o veículo já existia e o destino seria ativo:
```ts
if (statusDestino === 'ativo' && veiculoJaExistiaNoHinova && codigoVeiculoHinova) {
  await logSync(_vid, _aid, 'promover_situacao_veiculo', 'info',
    { codigo_veiculo: codigoVeiculoHinova },
    null,
    'Promoção para ATIVO não é feita automaticamente — operação deve ativar manualmente no painel SGA.');
}
```
Remover variável `promocaoOk` e o `if (!promocaoOk) return;` subsequente.

**d) `status_sga` local:** manter `'ativado_sga'` quando `statusDestino==='ativo'` (refere-se à efetivação local, não ao SGA — apenas indica que o sync local terminou).

## Validação após approve

1. Disparar nova sincronização de associado → verificar logs:
   - `cadastrar_associado` success
   - `alterar_situacao_associado` success com `codigo_situacao: 3`
2. Verificar no painel SGA que o associado aparece como **PENDENTE**.
3. Para veículos novos: `cadastrar_veiculo` success, sem chamada de `promover_situacao_veiculo`.
4. Para contratos ativados na Pratic: log `info` "Promoção para ATIVO não é feita automaticamente".

## Memória a atualizar

`mem://features/integrations/sga-hinova-sync-and-pre-check-v3` — adicionar regra: "Ativação no SGA é exclusivamente manual. Sistema só envia/força situação PENDENTE (código 3) — nunca ATIVO."