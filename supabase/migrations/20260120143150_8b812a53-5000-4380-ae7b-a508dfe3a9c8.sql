-- Tornar bucket 'instalacoes' público para exibir fotos de instalação
UPDATE storage.buckets 
SET public = true 
WHERE id = 'instalacoes';

-- Tornar bucket 'assinaturas' público para exibir assinaturas
UPDATE storage.buckets 
SET public = true 
WHERE id = 'assinaturas';

-- Tornar bucket 'vistoria-fotos' público (se existir)
UPDATE storage.buckets 
SET public = true 
WHERE id = 'vistoria-fotos';