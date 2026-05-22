-- Saneamento — Luiz (KZZ9E93) e Fernanda (chassi 9C2KF5200TR010548).
-- Servicos existentes (b3da7f84..., 225665d9...) já têm vistoria_origem_id correto,
-- mas estão com contrato_id/cotacao_id NULL e status='aprovada' (terminal, fora da fila).
-- Backfill + reabertura para 'concluida' faz reaparecer em Aprovação de Associados.

-- KZZ9E93 (Luiz)
UPDATE public.servicos
SET contrato_id  = '0471d8c6-2b96-49bb-9736-f37cc6032ea7'::uuid,
    cotacao_id   = 'fb58b2e7-b656-4d82-952d-24b6bf476055'::uuid,
    associado_id = '8a85497d-fa03-4b82-abeb-45c451c16fa8'::uuid,
    status       = 'concluida'::status_servico,
    concluida_em = COALESCE(concluida_em, now()),
    updated_at   = now()
WHERE id = '225665d9-d6b3-4a3e-b832-5a93d112eb92'::uuid;

-- Fernanda (9C2KF5200TR010548)
UPDATE public.servicos
SET contrato_id  = '1c48cb35-e457-48a7-b8f4-4626812ae0bd'::uuid,
    cotacao_id   = '0a1628e8-5c2d-490e-9c48-455dbd570228'::uuid,
    associado_id = 'f9937a83-7b66-4055-aa6e-f071b43f02bb'::uuid,
    status       = 'concluida'::status_servico,
    concluida_em = COALESCE(concluida_em, now()),
    updated_at   = now()
WHERE id = 'b3da7f84-cd47-444c-ab7d-a41678ef29d1'::uuid;

-- Fechar vistorias presenciais (vídeo já anexado).
UPDATE public.vistorias
SET status       = 'concluida'::status_vistoria,
    concluida_em = COALESCE(concluida_em, now()),
    contrato_id  = COALESCE(contrato_id, '0471d8c6-2b96-49bb-9736-f37cc6032ea7'::uuid),
    cotacao_id   = COALESCE(cotacao_id,  'fb58b2e7-b656-4d82-952d-24b6bf476055'::uuid),
    updated_at   = now()
WHERE id = '4a7cd90a-fb37-4bd3-a858-be31460e20f2'::uuid;

UPDATE public.vistorias
SET status       = 'concluida'::status_vistoria,
    concluida_em = COALESCE(concluida_em, now()),
    contrato_id  = COALESCE(contrato_id, '1c48cb35-e457-48a7-b8f4-4626812ae0bd'::uuid),
    cotacao_id   = COALESCE(cotacao_id,  '0a1628e8-5c2d-490e-9c48-455dbd570228'::uuid),
    updated_at   = now()
WHERE id = '413b8798-ccd3-4fed-91f2-cf3a737079f2'::uuid;

-- Marcar contratos.vistoria_concluida_em (não toca cadastro_aprovado nem promove).
UPDATE public.contratos
SET vistoria_concluida_em = COALESCE(vistoria_concluida_em, now()),
    updated_at = now()
WHERE id IN (
  '0471d8c6-2b96-49bb-9736-f37cc6032ea7'::uuid,
  '1c48cb35-e457-48a7-b8f4-4626812ae0bd'::uuid
);
