
-- Ativar carência de 120 dias (tipo liberação) para TODAS as coberturas
UPDATE coberturas
SET carencia_ativa = true,
    carencia_tipo = 'liberacao',
    carencia_dias = 120,
    carencia_multiplicador = 1
WHERE true;

-- Garantir que benefícios NÃO tenham carência (0 dias, desativado)
UPDATE benefits
SET carencia_ativa = false,
    carencia_tipo = 'liberacao',
    carencia_dias = 0,
    carencia_multiplicador = 1
WHERE true;
