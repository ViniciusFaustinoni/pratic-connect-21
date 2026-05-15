## Diagnóstico

A linha "MARCUS VINICIUS FAUSTINONI DE FREITAS — KOU6D37 — Amanhã às 08:00" em **Monitoramento › Atribuição Manual › Serviços Pendentes** vem de `agendamentos_base`, não de `servicos`. Existem **duas agendamentos antigos** que ficaram presos em aberto porque pertencem a cotações distintas das que de fato foram executadas:

| id | cotação | placa | data | status atual |
|----|---------|-------|------|--------------|
| `a4e7e00b-…` | `d54f5604-…` | KOU6D37 | 16/05 08:00 | `agendado` ← aparece na tela |
| `3a4a81b7-…` | `b06b482f-…` | LTB4J74 | 14/05 13:00 | `confirmado` |

A vistoria que o técnico **realmente concluiu hoje** está em outro registro (`d1b67e06-…`, cotação `89686857-…`, placa LTB4J74, status `realizado`). Como o trigger de dedupe de agendamentos_base fecha por `cotacao_id`, agendamentos de cotações distintas (mesmo cliente/placa) não são fechados em cascata — por isso esses dois ficaram pendurados.

O serviço `ada0bd18-…` (vistoria_entrada KOU6D37 do MARCOS DATIVO) já está `concluida`, então não é mais o causador.

## Ação

Migration única para limpar os dois agendamentos órfãos:

```sql
UPDATE agendamentos_base
SET status = 'cancelado',
    observacoes = COALESCE(observacoes,'') || ' [auto] Cancelado: agendamento órfão de cotação abandonada; cliente concluiu vistoria em outra cotação.',
    updated_at = now()
WHERE id IN (
  'a4e7e00b-abfd-4f7c-b790-7ae269f54546',  -- KOU6D37 16/05 08:00
  '3a4a81b7-d35b-4940-a32f-495826c35ef9'   -- LTB4J74 14/05 13:00
);
```

## Aceite

- Após a migration, a aba **Atribuição Manual** mostra apenas VICTOR SILVA DE MENEZES (TDC0F74) em "Amanhã".
- MARCUS VINICIUS some da fila.
- Nenhuma alteração estrutural — apenas dados.

## Observação (não-blocker, para depois)

O dedupe de agendamentos_base hoje só fecha quando outra agendamento da **mesma cotação** é realizado. Em casos de cliente que abre nova cotação (em vez de seguir a antiga), as agendamentos antigas ficam órfãs. Se quiser, num passo separado posso ampliar o trigger para também fechar agendamentos de cotações **canceladas/expiradas** do mesmo associado+placa — mas isso é mudança de regra e foge do escopo deste cleanup.