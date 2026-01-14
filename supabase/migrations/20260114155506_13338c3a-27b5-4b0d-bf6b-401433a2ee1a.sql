-- Tornar bucket documentos público para que as URLs das fotos funcionem
UPDATE storage.buckets 
SET public = true 
WHERE id = 'documentos';