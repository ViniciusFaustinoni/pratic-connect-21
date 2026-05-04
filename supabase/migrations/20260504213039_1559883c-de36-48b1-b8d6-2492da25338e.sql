CREATE OR REPLACE FUNCTION public.trg_cotacao_sync_instalacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.vistoria_data_agendada IS DISTINCT FROM OLD.vistoria_data_agendada)
     OR (NEW.vistoria_periodo IS DISTINCT FROM OLD.vistoria_periodo)
     OR (NEW.vistoria_horario_agendado IS DISTINCT FROM OLD.vistoria_horario_agendado)
     OR (NEW.vistoria_endereco_logradouro IS DISTINCT FROM OLD.vistoria_endereco_logradouro)
     OR (NEW.vistoria_endereco_numero IS DISTINCT FROM OLD.vistoria_endereco_numero)
     OR (NEW.vistoria_endereco_bairro IS DISTINCT FROM OLD.vistoria_endereco_bairro)
     OR (NEW.vistoria_endereco_cidade IS DISTINCT FROM OLD.vistoria_endereco_cidade)
     OR (NEW.vistoria_endereco_estado IS DISTINCT FROM OLD.vistoria_endereco_estado)
     OR (NEW.vistoria_endereco_cep IS DISTINCT FROM OLD.vistoria_endereco_cep)
     OR (NEW.vistoria_completa_data_agendada IS DISTINCT FROM OLD.vistoria_completa_data_agendada)
     OR (NEW.vistoria_completa_periodo IS DISTINCT FROM OLD.vistoria_completa_periodo)
     OR (NEW.vistoria_completa_endereco_logradouro IS DISTINCT FROM OLD.vistoria_completa_endereco_logradouro)
     OR (NEW.vistoria_completa_endereco_numero IS DISTINCT FROM OLD.vistoria_completa_endereco_numero)
     OR (NEW.vistoria_completa_endereco_bairro IS DISTINCT FROM OLD.vistoria_completa_endereco_bairro)
  THEN
    PERFORM public.sync_instalacao_from_cotacao(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotacao_sync_instalacao ON public.cotacoes;
CREATE TRIGGER trg_cotacao_sync_instalacao
AFTER UPDATE ON public.cotacoes
FOR EACH ROW
EXECUTE FUNCTION public.trg_cotacao_sync_instalacao();