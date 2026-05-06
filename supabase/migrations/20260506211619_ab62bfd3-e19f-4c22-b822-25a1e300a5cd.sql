-- Corrige estado inconsistente do veículo do ERICO MORAES (placa RIR1B37):
-- estava marcado como 'ativo' por bug em aprovar-proposta (já corrigido), mas
-- associado/contrato continuam em_analise/assinado e sem código Hinova. Reverte
-- para 'instalacao_pendente' para que volte à fila correta de Cadastro até a
-- vistoria ser aprovada e o ativar-associado executar a ativação completa.
UPDATE public.veiculos
SET status = 'instalacao_pendente',
    cobertura_total = false,
    cobertura_roubo_furto = false,
    updated_at = now()
WHERE id = '6aae322e-b207-432b-bdae-2c2a8c8916a4'
  AND status = 'ativo';

-- Procura por outros casos potencialmente impactados pelo mesmo bug:
-- veículo='ativo' mas associado ainda 'em_analise'/'aguardando_instalacao'
-- e sem código Hinova. Reverte todos para 'instalacao_pendente'.
UPDATE public.veiculos v
SET status = 'instalacao_pendente',
    cobertura_total = false,
    cobertura_roubo_furto = false,
    updated_at = now()
FROM public.associados a
WHERE v.associado_id = a.id
  AND v.status = 'ativo'
  AND v.codigo_hinova IS NULL
  AND v.sincronizado_hinova = false
  AND a.status IN ('em_analise', 'aguardando_instalacao')
  AND a.codigo_hinova IS NULL;