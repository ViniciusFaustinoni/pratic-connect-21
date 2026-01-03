-- Função para recalcular valor do orçamento
CREATE OR REPLACE FUNCTION public.atualizar_valor_os(os_id UUID)
RETURNS VOID AS $$
DECLARE
  novo_valor DECIMAL(12,2);
BEGIN
  SELECT COALESCE(SUM(valor_total), 0)
  INTO novo_valor
  FROM ordens_servico_itens
  WHERE ordem_servico_id = os_id;
  
  UPDATE ordens_servico
  SET valor_orcamento = novo_valor,
      updated_at = NOW()
  WHERE id = os_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger function para atualizar automaticamente
CREATE OR REPLACE FUNCTION public.trigger_atualizar_valor_os()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM atualizar_valor_os(OLD.ordem_servico_id);
    RETURN OLD;
  ELSE
    PERFORM atualizar_valor_os(NEW.ordem_servico_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger que dispara após alterações nos itens
CREATE TRIGGER on_item_os_change
  AFTER INSERT OR UPDATE OR DELETE ON ordens_servico_itens
  FOR EACH ROW
  EXECUTE FUNCTION trigger_atualizar_valor_os();