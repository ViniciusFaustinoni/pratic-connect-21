
-- Delete existing faixas for Premium and Exclusive
DELETE FROM public.planos_taxa_administrativa 
WHERE plano_id IN ('056a856b-d4b6-4ea5-93a8-f0eb2d521473', 'a965d761-aae5-4ca4-ad1c-5f2a487d63b9');

-- Copy Basic's faixas to Exclusive
INSERT INTO public.planos_taxa_administrativa (plano_id, fipe_de, fipe_ate, valor_taxa)
SELECT '056a856b-d4b6-4ea5-93a8-f0eb2d521473', fipe_de, fipe_ate, valor_taxa
FROM public.planos_taxa_administrativa
WHERE plano_id = 'cfe38797-0e78-4eaf-b9fb-59bee78adc41';

-- Copy Basic's faixas to Premium
INSERT INTO public.planos_taxa_administrativa (plano_id, fipe_de, fipe_ate, valor_taxa)
SELECT 'a965d761-aae5-4ca4-ad1c-5f2a487d63b9', fipe_de, fipe_ate, valor_taxa
FROM public.planos_taxa_administrativa
WHERE plano_id = 'cfe38797-0e78-4eaf-b9fb-59bee78adc41';
