

# Plano: Notificação de Estorno para o Vendedor (4.13)

## O que muda

Atualizar a function `fn_notificar_pagamento_vendedor` para também detectar quando o status muda para `'cancelado'` (estorno) e inserir uma notificação com o motivo.

### Migration SQL

```sql
CREATE OR REPLACE FUNCTION public.fn_notificar_pagamento_vendedor()
RETURNS TRIGGER AS $$
BEGIN
  -- Notificação de pagamento
  IF NEW.status = 'pago' AND OLD.status != 'pago' AND NEW.tipo = 'credito' THEN
    INSERT INTO notificacoes_vendas (usuario_id, tipo, titulo, mensagem, dados_extras)
    VALUES (
      NEW.vendedor_id,
      'pagamento_comissao',
      'Pagamento recebido!',
      FORMAT('Comissão de R$ %s foi paga em %s',
        TO_CHAR(NEW.valor_liquido, 'FM999G999D00'),
        TO_CHAR(NEW.data_pagamento::date, 'DD/MM/YYYY')),
      jsonb_build_object('lancamento_id', NEW.id, 'valor', NEW.valor_liquido)
    );
  END IF;

  -- Notificação de estorno
  IF NEW.status = 'cancelado' AND OLD.status != 'cancelado' THEN
    INSERT INTO notificacoes_vendas (usuario_id, tipo, titulo, mensagem, dados_extras)
    VALUES (
      NEW.vendedor_id,
      'estorno_comissao',
      'Comissão estornada',
      FORMAT('Comissão de R$ %s foi estornada. Motivo: %s',
        TO_CHAR(NEW.valor_liquido, 'FM999G999D00'),
        COALESCE(NEW.observacao_pagamento, 'Não informado')),
      jsonb_build_object('lancamento_id', NEW.id, 'valor', NEW.valor_liquido, 'motivo', NEW.observacao_pagamento)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

O trigger `trg_notificar_pagamento` já existe e continua apontando para a mesma function — basta o `CREATE OR REPLACE`.

## Arquivo afetado

| Arquivo | Alteração |
|---|---|
| Migration SQL | `CREATE OR REPLACE` da function com bloco adicional para estorno |

Nenhuma alteração no frontend — o `useNotificacoesVendasRealtime()` já captura qualquer INSERT na `notificacoes_vendas` e exibe o toast automaticamente.

