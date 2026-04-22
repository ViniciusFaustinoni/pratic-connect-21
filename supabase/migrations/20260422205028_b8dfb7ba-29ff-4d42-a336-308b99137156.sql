-- Suporte para veículos 0km com placa provisória no Hinova/SGA
ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS aguardando_placa_definitiva BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS placa_provisoria TEXT,
  ADD COLUMN IF NOT EXISTS placa_definitiva_atualizada_em TIMESTAMPTZ;

COMMENT ON COLUMN public.veiculos.aguardando_placa_definitiva IS 'Indica que o veículo é 0km e foi cadastrado no Hinova/SGA com placa provisória (ZZZ + 4 últimos do chassi). Deve disparar atualização no Hinova quando a placa real for informada.';
COMMENT ON COLUMN public.veiculos.placa_provisoria IS 'Placa provisória usada no cadastro Hinova quando o veículo ainda não foi emplacado. Formato ZZZ9999.';
COMMENT ON COLUMN public.veiculos.placa_definitiva_atualizada_em IS 'Data/hora em que a placa definitiva substituiu a provisória no Hinova.';

CREATE INDEX IF NOT EXISTS idx_veiculos_aguardando_placa ON public.veiculos (aguardando_placa_definitiva) WHERE aguardando_placa_definitiva = true;