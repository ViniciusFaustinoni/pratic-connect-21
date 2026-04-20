INSERT INTO public.vistorias (
  associado_id, veiculo_id, vistoriador_id, contrato_id, cotacao_id,
  tipo, status, data_agendada, horario_agendado,
  endereco_cep, endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade
)
SELECT s.associado_id, s.veiculo_id, s.profissional_id, s.contrato_id, s.cotacao_id,
       'entrada', 'em_analise', s.data_agendada, s.hora_agendada,
       s.cep, s.logradouro, s.numero, s.bairro, s.cidade
FROM public.servicos s
WHERE s.id = '0a536015-e9a0-425c-bdcd-b2b71e540722'
  AND NOT EXISTS (
    SELECT 1 FROM public.vistorias v
    WHERE v.associado_id = s.associado_id
      AND v.veiculo_id   = s.veiculo_id
      AND COALESCE(v.cotacao_id::text,'') = COALESCE(s.cotacao_id::text,'')
      AND v.status = 'em_analise'
  );