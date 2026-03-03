

# Plano: Despacho automatico de reboque ao criar chamado de assistencia

## Situacao atual
O fluxo ja esta implementado e funcionando:
- `despacho-reboque-disparar` envia WhatsApp para todos os reboquistas com dados do veiculo e rota (ponto A → ponto B)
- `whatsapp-meta-webhook` processa respostas: SIM → pede localizacao → calcula distancia → informa valor sugerido → aceite
- `CardDespachoReboque` mostra top 3 aceitos (menor valor + mais proximo) para selecao manual do analista

**O que falta**: O despacho so acontece quando o analista clica manualmente em "Despachar Reboque via WhatsApp". O usuario quer que seja **automatico ao criar o chamado**.

## Mudanca proposta
Adicionar disparo automatico do despacho na edge function `criar-chamado-assistencia` quando o tipo de servico for reboque/guincho.

### Ajuste em `criar-chamado-assistencia/index.ts`
Apos criar o chamado (linha ~332), se `tipo_servico` for `reboque` ou `guincho`:
1. Chamar `despacho-reboque-disparar` automaticamente (via fetch interno com service key)
2. Logar resultado no console
3. Nao bloquear o fluxo se falhar — chamado ja foi criado

Codigo aproximado a adicionar apos a criacao do chamado:

```typescript
// Auto-despacho para reboque/guincho
if (['reboque', 'guincho'].includes(payload.tipo_assistencia)) {
  try {
    const despRes = await fetch(`${supabaseUrl}/functions/v1/despacho-reboque-disparar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ chamado_id: chamado.id }),
    });
    const despData = await despRes.json();
    console.log('[criar-chamado] Auto-despacho:', despData);
  } catch (e) {
    console.error('[criar-chamado] Erro no auto-despacho:', e);
  }
}
```

### Ajuste em `despacho-reboque-disparar/index.ts`
A funcao exige JWT de usuario autenticado (linhas 18-23). Porem, quando chamada internamente pelo `criar-chamado-assistencia` com service key, nao ha JWT de usuario. Precisa aceitar tambem chamadas com service role key (sem exigir `getUser`).

Logica: se o bearer token for o service role key, pular validacao de usuario. Caso contrario, validar normalmente.

## Arquivos afetados

| Arquivo | Acao |
|---------|------|
| `supabase/functions/criar-chamado-assistencia/index.ts` | Adicionar auto-despacho apos criar chamado de reboque |
| `supabase/functions/despacho-reboque-disparar/index.ts` | Aceitar chamadas internas com service key (sem JWT de usuario) |

## O que NAO muda
- Fluxo conversacional do webhook (ja funciona)
- CardDespachoReboque (ja mostra top 3)
- Logica de calculo de valor (ja funciona)
- Botao manual de despacho continua disponivel como fallback/reenvio

