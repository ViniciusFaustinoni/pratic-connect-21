
-- Trigger: gerar notificação automática quando cc_vendedor_lancamentos muda status para pago ou cancelado
CREATE OR REPLACE FUNCTION public.fn_notificar_cc_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo TEXT;
  v_mensagem TEXT;
  v_nome_associado TEXT;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('pago', 'cancelado') THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_nome_associado
  FROM associados
  WHERE id = NEW.associado_id;

  v_nome_associado := COALESCE(v_nome_associado, 'N/A');

  IF NEW.status = 'pago' THEN
    v_titulo := 'Comissão Paga';
    v_mensagem := format(
      'Sua comissão de %s referente à venda de %s foi paga em %s.',
      'R$ ' || to_char(NEW.valor_liquido, 'FM999G999D00'),
      v_nome_associado,
      to_char(COALESCE(NEW.data_pagamento, now()), 'DD/MM/YYYY')
    );
  ELSIF NEW.status = 'cancelado' THEN
    v_titulo := 'Comissão Estornada';
    v_mensagem := format(
      'A comissão de %s referente à venda de %s foi estornada. Motivo: %s.',
      'R$ ' || to_char(NEW.valor_liquido, 'FM999G999D00'),
      v_nome_associado,
      COALESCE(NEW.observacao_pagamento, 'Não informado')
    );
  END IF;

  INSERT INTO notificacoes (
    user_id,
    titulo,
    mensagem,
    tipo,
    categoria,
    modulo,
    referencia_tipo,
    referencia_id,
    link,
    canal_sistema
  ) VALUES (
    NEW.vendedor_id,
    v_titulo,
    v_mensagem,
    CASE WHEN NEW.status = 'pago' THEN 'sucesso' ELSE 'alerta' END,
    'financeiro',
    'comissoes',
    'cc_vendedor_lancamentos',
    NEW.id,
    '/perfil/conta-corrente',
    true
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cc_notificar_status ON cc_vendedor_lancamentos;
CREATE TRIGGER trg_cc_notificar_status
  AFTER UPDATE ON cc_vendedor_lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION fn_notificar_cc_status_change();
