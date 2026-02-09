
-- Função para gerar protocolo automático em servicos
CREATE OR REPLACE FUNCTION public.gerar_protocolo_servico()
RETURNS TRIGGER AS $$
DECLARE
  prefixo TEXT;
  ano TEXT;
  sequencial INT;
  novo_protocolo TEXT;
BEGIN
  -- Definir prefixo baseado no tipo de serviço
  CASE NEW.tipo::text
    WHEN 'instalacao' THEN prefixo := 'INS';
    WHEN 'vistoria_entrada' THEN prefixo := 'VEN';
    WHEN 'vistoria_saida' THEN prefixo := 'VSA';
    WHEN 'vistoria_sinistro' THEN prefixo := 'VSN';
    WHEN 'vistoria_periodica' THEN prefixo := 'VPE';
    WHEN 'vistoria_manutencao' THEN prefixo := 'MAN';
    WHEN 'vistoria_retirada' THEN prefixo := 'RET';
    ELSE prefixo := 'SRV';
  END CASE;

  ano := EXTRACT(YEAR FROM NOW())::TEXT;

  -- Contar quantos serviços desse tipo já existem no ano
  SELECT COUNT(*) + 1 INTO sequencial
  FROM public.servicos
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
    AND tipo = NEW.tipo;

  -- Formato: RET-2026-00001
  novo_protocolo := prefixo || '-' || ano || '-' || LPAD(sequencial::TEXT, 5, '0');

  NEW.protocolo := novo_protocolo;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger BEFORE INSERT
DROP TRIGGER IF EXISTS trigger_gerar_protocolo_servico ON public.servicos;
CREATE TRIGGER trigger_gerar_protocolo_servico
  BEFORE INSERT ON public.servicos
  FOR EACH ROW
  WHEN (NEW.protocolo IS NULL)
  EXECUTE FUNCTION public.gerar_protocolo_servico();

-- Atualizar protocolo do serviço existente que está sem protocolo
UPDATE public.servicos 
SET protocolo = 'RET-2026-00001'
WHERE id = 'ea0979bf-acf4-4093-870b-4dce24c48a9a' AND protocolo IS NULL;
