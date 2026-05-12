-- Limpeza one-shot da duplicata Base→Rota do veículo RJM3D69 (Carlos Roberto Alves)
-- Cancela o serviço/instalação duplicados criados por criar-instalacao-pos-pagamento;
-- mantém intacta a vistoria_entrada que o técnico Wallace já está executando.

UPDATE public.servicos
   SET status = 'cancelada'::status_servico,
       observacoes = COALESCE(observacoes, '') ||
         E'\n[fix duplicata base/rota] Cancelado — atendimento coberto pela vistoria_entrada da base.'
 WHERE id = '74e0cec9-cf85-4ecb-ac3e-6f9e4d3df1d6';

UPDATE public.instalacoes
   SET status = 'cancelada'::status_instalacao,
       observacoes = COALESCE(observacoes, '') ||
         E'\n[fix duplicata base/rota] Cancelada — duplicava vistoria base existente.'
 WHERE id = '93c2038b-755d-4354-8cdc-6ea1d8bc4a05';

UPDATE public.agendamentos_base
   SET instalacao_id = NULL,
       updated_at = now()
 WHERE id = '7bf883da-ad69-46fb-8f0c-a78eb2b9ddee';