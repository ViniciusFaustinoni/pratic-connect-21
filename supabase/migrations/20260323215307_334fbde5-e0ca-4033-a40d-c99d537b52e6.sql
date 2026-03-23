CREATE OR REPLACE FUNCTION public.fn_notificar_pagamento_vendedor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;