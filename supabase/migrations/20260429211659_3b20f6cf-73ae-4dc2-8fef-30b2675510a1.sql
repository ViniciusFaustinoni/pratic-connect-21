UPDATE public.contratos
   SET veiculo_numero_portas = 2,
       veiculo_tipo_uso = COALESCE(veiculo_tipo_uso, 'particular')
 WHERE veiculo_placa = 'KXT0874';

UPDATE public.cotacoes
   SET numero_portas = 2,
       veiculo_tipo_uso = COALESCE(veiculo_tipo_uso, 'particular')
 WHERE veiculo_placa = 'KXT0874';