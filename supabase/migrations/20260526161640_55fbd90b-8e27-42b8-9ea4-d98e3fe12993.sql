
-- 1) Trigger BEFORE INSERT em agendamentos_base
CREATE OR REPLACE FUNCTION public.fn_guard_agendamento_base_exige_cadastro_aprovado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aprovado_em timestamptz;
  v_origem_troca uuid;
BEGIN
  IF NEW.cotacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.aprovado_em, c.origem_troca_titularidade_id
    INTO v_aprovado_em, v_origem_troca
  FROM public.contratos c
  WHERE c.cotacao_id = NEW.cotacao_id
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_origem_troca IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF v_aprovado_em IS NULL THEN
    RAISE EXCEPTION 'agendamento_base bloqueado: contrato da cotação % ainda não foi aprovado pelo Cadastro', NEW.cotacao_id
      USING ERRCODE = 'check_violation',
            HINT = 'Aguardar aprovação do Cadastro antes de criar agendamento de Monitoramento';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_agendamento_base_exige_cadastro_aprovado ON public.agendamentos_base;
CREATE TRIGGER trg_guard_agendamento_base_exige_cadastro_aprovado
  BEFORE INSERT ON public.agendamentos_base
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_agendamento_base_exige_cadastro_aprovado();

-- 2) Recriar view servicos_pendentes_rota com gate Cadastro
DROP VIEW IF EXISTS public.servicos_pendentes_rota;

CREATE VIEW public.servicos_pendentes_rota AS
-- Instalações pendentes
SELECT
  i.id,
  'instalacao'::text as tipo_servico,
  NULL::text as tipo_vistoria,
  i.bairro as endereco_bairro,
  i.cidade as endereco_cidade,
  i.cep as endereco_cep,
  i.logradouro as endereco_logradouro,
  i.numero as endereco_numero,
  i.data_agendada,
  i.periodo,
  i.rota_id,
  a.id as associado_id,
  a.nome as associado_nome,
  a.telefone as associado_telefone,
  v.id as veiculo_id,
  v.placa,
  v.marca,
  v.modelo
FROM public.instalacoes i
LEFT JOIN public.associados a ON a.id = i.associado_id
LEFT JOIN public.veiculos v ON v.id = i.veiculo_id
LEFT JOIN LATERAL (
  SELECT c.aprovado_em, c.origem_troca_titularidade_id
  FROM public.contratos c
  WHERE c.veiculo_id = i.veiculo_id
  ORDER BY c.created_at DESC
  LIMIT 1
) ct ON true
WHERE i.status IN ('agendada', 'reagendada')
  AND (
    ct.aprovado_em IS NULL AND ct.origem_troca_titularidade_id IS NULL AND NOT EXISTS (
      SELECT 1 FROM public.contratos c2 WHERE c2.veiculo_id = i.veiculo_id
    )
    OR ct.aprovado_em IS NOT NULL
    OR ct.origem_troca_titularidade_id IS NOT NULL
  )

UNION ALL

-- Vistorias pendentes (tabela unificada)
SELECT
  vis.id,
  COALESCE(vis.origem, 'vistoria')::text as tipo_servico,
  vis.tipo::text as tipo_vistoria,
  vis.endereco_bairro,
  vis.endereco_cidade,
  vis.endereco_cep,
  vis.endereco_logradouro,
  vis.endereco_numero,
  vis.data_agendada,
  NULL as periodo,
  vis.rota_id,
  COALESCE(vis.associado_id, l.associado_id) as associado_id,
  COALESCE(a.nome, l.nome) as associado_nome,
  COALESCE(a.telefone, l.telefone) as associado_telefone,
  vis.veiculo_id,
  COALESCE(ve.placa, cot.veiculo_placa, ctr.veiculo_placa) as placa,
  COALESCE(ve.marca, cot.veiculo_marca, ctr.veiculo_marca) as marca,
  COALESCE(ve.modelo, cot.veiculo_modelo, ctr.veiculo_modelo) as modelo
FROM public.vistorias vis
LEFT JOIN public.associados a ON a.id = vis.associado_id
LEFT JOIN public.leads l ON l.id = vis.lead_id
LEFT JOIN public.veiculos ve ON ve.id = vis.veiculo_id
LEFT JOIN public.cotacoes cot ON cot.id = vis.cotacao_id
LEFT JOIN public.contratos ctr ON ctr.id = vis.contrato_id
WHERE vis.status IN ('pendente', 'em_analise')
  AND (
    vis.contrato_id IS NULL
    OR ctr.aprovado_em IS NOT NULL
    OR ctr.origem_troca_titularidade_id IS NOT NULL
  );
