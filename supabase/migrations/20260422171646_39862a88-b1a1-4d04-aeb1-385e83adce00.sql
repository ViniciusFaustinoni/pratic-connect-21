UPDATE public.veiculos
SET status = 'ativo', updated_at = NOW()
WHERE id IN (
  'a0136944-7d40-422d-94f2-da6f5c5c65b4',
  'f5bd7c0f-7240-4a3a-b2e0-79b5cb3df0fc'
);

UPDATE public.servicos
SET status = 'cancelada',
    observacoes = COALESCE(observacoes, '') || E'\n[2026-04-22] Cancelada — veículo PYN0C82 cadastrado manualmente no SGA Hinova (codigo_veiculo=35776, codigo_associado=23652). Não há mais necessidade de instalação física separada — associado já ativo na base antiga.',
    updated_at = NOW()
WHERE id = 'e36f0ffb-f29e-4e43-85e7-a73752e053d1';

INSERT INTO public.associados_historico (associado_id, tipo, acao, descricao, created_at)
VALUES (
  '51ec89d2-57c9-44a7-8e93-1cf521196184',
  'status_alterado',
  'sincronizacao_manual_sga',
  'Sincronização manual SGA Hinova: veículo PYN0C82 (Montana) cadastrado no SGA com codigo_veiculo=35776, reutilizando codigo_associado=23652 da base antiga. Causa do gap: sync original em 20/04/2026 só processou KXS2259 (Kombi); o trigger nunca foi disparado para o Montana quando ele virou Roubo/Furto. Bypass de guard_base_antiga aplicado com segurança (codigo_hinova já existia, sem risco de duplicar associado). Ambos veículos (KXS2259 e PYN0C82) ativados localmente. Serviço de instalação obsoleto e36f0ffb cancelado.',
  NOW()
);