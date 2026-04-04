

# Validação de associado_id e veiculo_id no Reagendamento Automático

## Problema
Quando um serviço é reagendado automaticamente (via link público ou WhatsApp), o novo serviço copia `associado_id` e `veiculo_id` do original. Se o original já tem esses campos NULL, cria-se um serviço órfão que aparece no mapa sem dados.

## Alterações

### 1. `supabase/functions/reagendar-vistoria-publica/index.ts`
Antes do insert (linha ~131), adicionar validação:
```typescript
if (!servico.associado_id || !servico.veiculo_id) {
  throw new Error("Serviço original incompleto (sem associado ou veículo). Não é possível reagendar.");
}
```

### 2. `supabase/functions/whatsapp-webhook/index.ts`
Antes do insert do novo serviço (linha ~2477), adicionar a mesma validação:
```typescript
if (!servicoOriginalDados.associado_id || !servicoOriginalDados.veiculo_id) {
  // Informar o cliente que precisa ligar para a central
  const msg = `Desculpe, não foi possível reagendar automaticamente. Entre em contato com a central ${tel0800}.`;
  await sendWhatsAppMessage(...);
  return new Response(JSON.stringify({ ok: false, error: "servico_incompleto" }), { headers: corsHeaders });
}
```

### 3. `supabase/functions/cron-reagendamento-automatico/index.ts`
Na Parte 1 (órfãos, linha ~160) e Parte 2 (vencidos, linha ~268), antes de chamar `enviar-link-reagendamento`, validar que o serviço tem `associado_id` e `veiculo_id`. Se não tiver, cancelar direto em vez de tentar reagendar:
```typescript
if (!orfao.associado_id || !orfao.veiculo_id) {
  await supabase.from("servicos").update({ status: "cancelada", observacoes: "Cancelado automaticamente: sem associado/veículo vinculado" }).eq("id", orfao.id);
  continue;
}
```

Adicionar `associado_id, veiculo_id` ao select de serviços (~linha 190) para ter acesso a esses campos.

## Arquivos alterados
| Arquivo | Ação |
|---------|------|
| `supabase/functions/reagendar-vistoria-publica/index.ts` | Guard antes do insert |
| `supabase/functions/whatsapp-webhook/index.ts` | Guard antes do insert |
| `supabase/functions/cron-reagendamento-automatico/index.ts` | Cancelar órfãos sem associado em vez de reagendar |

