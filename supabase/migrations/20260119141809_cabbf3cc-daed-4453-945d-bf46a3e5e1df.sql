-- Adicionar coluna contrato_id na tabela instalacoes
ALTER TABLE public.instalacoes 
ADD COLUMN IF NOT EXISTS contrato_id UUID REFERENCES public.contratos(id);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_instalacoes_contrato_id ON public.instalacoes(contrato_id);

-- Trigger para propagar vistoria_concluida_em quando instalação é concluída
CREATE OR REPLACE FUNCTION public.propagar_conclusao_instalacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando instalação é concluída, atualizar origem (cotacao ou contrato)
  IF NEW.status = 'concluida' AND (OLD.status IS NULL OR OLD.status != 'concluida') THEN
    -- Verificar se tem cotacao_id
    IF NEW.cotacao_id IS NOT NULL THEN
      UPDATE public.cotacoes 
      SET vistoria_concluida_em = COALESCE(NEW.concluida_em, NOW())
      WHERE id = NEW.cotacao_id;
    END IF;
    
    -- Verificar se tem contrato_id
    IF NEW.contrato_id IS NOT NULL THEN
      UPDATE public.contratos 
      SET vistoria_concluida_em = COALESCE(NEW.concluida_em, NOW())
      WHERE id = NEW.contrato_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remover trigger se existir
DROP TRIGGER IF EXISTS trigger_propagar_conclusao_instalacao ON public.instalacoes;

-- Criar trigger
CREATE TRIGGER trigger_propagar_conclusao_instalacao
AFTER UPDATE ON public.instalacoes
FOR EACH ROW
EXECUTE FUNCTION public.propagar_conclusao_instalacao();

-- Corrigir dados históricos: instalações já concluídas que não propagaram (apenas cotações por enquanto)
UPDATE public.cotacoes c
SET vistoria_concluida_em = i.concluida_em
FROM public.instalacoes i
WHERE i.cotacao_id = c.id
  AND i.status = 'concluida'
  AND c.vistoria_concluida_em IS NULL;