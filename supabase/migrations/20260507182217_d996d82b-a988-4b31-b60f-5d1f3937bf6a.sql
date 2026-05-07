
-- contratos.vendedor_id → profiles(id)
UPDATE public.contratos
SET vendedor_id = '98705af7-b302-4133-a15d-51431a57d490'
WHERE associado_id = 'ec43f40d-cc36-4983-88a3-a7da426be689';

-- cotacoes.vendedor_id → auth.users(id)
UPDATE public.cotacoes
SET vendedor_id = 'bd3608cc-f132-4898-9d38-53b45a0630fd'
WHERE id = '3e1571a2-1fcc-4f78-8d90-161716533740';

-- associados.vendedor_original_id (sem FK declarada — segue padrão profile.id)
UPDATE public.associados
SET vendedor_original_id = '98705af7-b302-4133-a15d-51431a57d490'
WHERE id = 'ec43f40d-cc36-4983-88a3-a7da426be689';

-- Marcar veículo para reprocessar no SGA
UPDATE public.veiculos
SET sincronizado_hinova = false,
    status_sga = 'pendente_sincronizacao'
WHERE id = 'a474e4d6-b6fb-4bbd-bbc0-7e58402b1ab2';
