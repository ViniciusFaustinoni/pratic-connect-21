UPDATE public.veiculos
SET
  placa = 'ZZZ3366',
  placa_provisoria = 'ZZZ3366',
  aguardando_placa_definitiva = true,
  status_sga = 'pendente',
  sincronizado_hinova = false,
  updated_at = NOW()
WHERE id = '0907831e-3791-4f3d-b46f-8485d923bf27';