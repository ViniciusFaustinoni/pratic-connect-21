-- Deletar veículo vinculado primeiro (evitar erro de foreign key)
DELETE FROM veiculos WHERE id = '5c2c3406-3fd4-4079-984a-b9172801d636';

-- Deletar associado
DELETE FROM associados WHERE id = '6fad0f0b-ace4-48c1-90d7-45b3791f8bdb';