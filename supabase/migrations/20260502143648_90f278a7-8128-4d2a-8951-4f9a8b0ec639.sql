-- Limpa chassis com tamanho inválido (≠ 17) em cotações existentes para
-- destravar finalização. Chassi é sempre manual; valores inválidos serão
-- redigitados pelo associado/operador no fluxo correto.
UPDATE public.cotacoes
SET veiculo_chassi = NULL
WHERE veiculo_chassi IS NOT NULL
  AND veiculo_chassi <> ''
  AND veiculo_chassi !~ '^[A-HJ-NPR-Z0-9]{17}$';