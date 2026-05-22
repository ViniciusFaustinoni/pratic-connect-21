
INSERT INTO public.agendamentos_base (
  cotacao_id, data_agendada, horario, cliente_nome, cliente_telefone, veiculo_placa,
  veiculo_descricao, status, observacoes
)
SELECT
  c.id,
  c.vistoria_data_agendada,
  (CASE c.vistoria_periodo WHEN 'manha' THEN '08:00' WHEN 'tarde' THEN '13:00' ELSE '08:00' END)::time,
  c.nome_solicitante,
  c.telefone1_solicitante,
  c.veiculo_placa,
  trim(coalesce(c.veiculo_marca,'') || ' ' || coalesce(c.veiculo_modelo,'')),
  'agendado',
  'Materializado manualmente (sub-FIPE com vistoria presencial) — destrava guard sem_vistoria_materializada'
FROM public.cotacoes c
WHERE c.id = 'fb58b2e7-b656-4d82-952d-24b6bf476055'
  AND NOT EXISTS (SELECT 1 FROM public.agendamentos_base ab WHERE ab.cotacao_id = c.id);
