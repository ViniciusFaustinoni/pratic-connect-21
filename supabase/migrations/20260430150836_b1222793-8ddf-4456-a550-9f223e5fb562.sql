
DELETE FROM public.hinova_mapeamentos
 WHERE tipo = 'combustivel'
   AND codigo_local IN ('gnv', 'eletrico', 'hibrido');
