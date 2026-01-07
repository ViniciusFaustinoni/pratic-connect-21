-- Garantir que a função existe com referência a profiles (não usuarios)
CREATE OR REPLACE FUNCTION public.trigger_distribuir_lead()
RETURNS TRIGGER AS $$
BEGIN
    -- Só distribuir se não tiver vendedor e etapa for 'novo'
    IF NEW.vendedor_id IS NULL AND NEW.etapa = 'novo' THEN
        NEW.vendedor_id := get_proximo_vendedor_distribuicao();
        
        -- Registrar histórico e atualizar contador se atribuiu
        IF NEW.vendedor_id IS NOT NULL THEN
            INSERT INTO distribuicao_historico (lead_id, vendedor_id, atribuido_automaticamente, motivo)
            VALUES (NEW.id, NEW.vendedor_id, true, 'round_robin');
            
            UPDATE distribuicao_vendedores
            SET leads_hoje = leads_hoje + 1,
                total_leads = total_leads + 1,
                ultima_atribuicao = NOW(),
                updated_at = NOW()
            WHERE vendedor_id = NEW.vendedor_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar o trigger na tabela leads
DROP TRIGGER IF EXISTS trigger_auto_distribuir_lead ON leads;
CREATE TRIGGER trigger_auto_distribuir_lead
    BEFORE INSERT ON leads
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_distribuir_lead();