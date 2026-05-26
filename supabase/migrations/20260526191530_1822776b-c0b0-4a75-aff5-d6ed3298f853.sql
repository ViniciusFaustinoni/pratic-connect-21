UPDATE public.rastreadores
SET plataforma_veiculo_id = NULL,
    softruck_integration_status = 'pending',
    softruck_last_attempt_at = NULL
WHERE imei = '869412072526525';

INSERT INTO public.logs_auditoria (tabela, registro_id, acao, descricao, usuario_id)
SELECT 'rastreadores', id, 'criar',
  '[RECONCILIACAO_SOFTRUCK] Limpou plataforma_veiculo_id legado (apontava para veículo antigo da KPX3F78). Softruck confirma device sem vínculo. Será re-vinculado a TUM3D59 via softruck-ativar-dispositivo.',
  '37beadcf-284b-4a2c-88a0-6efa8cae60d9'::uuid
FROM public.rastreadores WHERE imei='869412072526525';