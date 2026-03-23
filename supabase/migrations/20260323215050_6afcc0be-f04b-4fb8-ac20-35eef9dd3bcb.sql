
-- Function to notify vendor when commission is paid
CREATE OR REPLACE FUNCTION public.fn_notificar_pagamento_vendedor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
  RETURN NEW;
END;
$$;

-- Trigger on cc_vendedor_lancamentos
CREATE TRIGGER trg_notificar_pagamento
AFTER UPDATE ON cc_vendedor_lancamentos
FOR EACH ROW EXECUTE FUNCTION fn_notificar_pagamento_vendedor();
