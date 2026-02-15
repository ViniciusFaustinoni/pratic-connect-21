

# Atualizar status do sinistro apos agendamento

## Problema

Quando o associado conclui o agendamento da vistoria, a edge function `agendar-vistoria-evento` atualiza apenas o campo `etapa4_completada_em` no link, mas nao atualiza o status do sinistro. O sinistro permanece como "documentacao_enviada" ao inves de mudar para um status que reflita que a vistoria foi agendada.

## Solucao

**Arquivo: `supabase/functions/agendar-vistoria-evento/index.ts`**

Adicionar uma chamada para atualizar o status do sinistro para `pendente_vistoria_regulador` logo apos atualizar o `etapa4_completada_em` do link (linha 159):

```typescript
// Atualizar link com etapa4_completada_em
await supabase
  .from("sinistro_evento_links")
  .update({ etapa4_completada_em: new Date().toISOString() })
  .eq("id", link.id);

// Atualizar status do sinistro para pendente de vistoria
await supabase
  .from("sinistros")
  .update({ status: "pendente_vistoria_regulador" })
  .eq("id", link.sinistro_id);
```

Isso fara com que, apos o agendamento, o status do evento mude automaticamente de "Documentacao Recebida" para "Pendente Vistoria Regulador", refletindo corretamente o estado real do fluxo.

Alteracao de 4 linhas em um unico arquivo (edge function).

