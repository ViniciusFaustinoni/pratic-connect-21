
UPDATE associados SET status='em_analise', updated_at=now()
WHERE id='e1823797-eaf9-4e97-8f20-dd1e7276f485';

UPDATE contratos SET cadastro_aprovado=false, aprovado_em=NULL, aprovado_por=NULL, updated_at=now()
WHERE id='ae3b10af-100a-462d-8394-6be39a54d801';

UPDATE veiculos SET cobertura_roubo_furto=false, cobertura_total=false, cobertura_suspensa=true, updated_at=now()
WHERE placa='KZK1I95';
