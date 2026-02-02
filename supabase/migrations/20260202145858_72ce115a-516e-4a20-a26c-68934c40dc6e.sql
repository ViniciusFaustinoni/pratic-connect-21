-- Resetar o estado de sincronização para forçar nova tentativa
UPDATE associados 
SET sincronizado_hinova = false, codigo_hinova = NULL, sincronizado_hinova_em = NULL
WHERE id = '183332a8-9c10-4015-9ece-ad9cb1aa9929';