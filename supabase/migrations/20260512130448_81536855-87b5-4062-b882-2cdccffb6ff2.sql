-- Corrige categoria poluída do veículo de Carlos Roberto Alves (RJM3D69 — Chevrolet Onix).
-- Ver mem://logic/operations/cotacao-categoria-vs-tipo-veiculo
UPDATE cotacoes
   SET categoria = NULL,
       updated_at = NOW()
 WHERE id = '6c6871ae-547c-4967-b466-19fee4fce30f'
   AND categoria = 'moto';

UPDATE contratos
   SET veiculo_categoria = 'Automóvel',
       updated_at = NOW()
 WHERE id = '13899c82-97b0-4069-9440-86b4c34f6e6a'
   AND veiculo_categoria = 'moto';