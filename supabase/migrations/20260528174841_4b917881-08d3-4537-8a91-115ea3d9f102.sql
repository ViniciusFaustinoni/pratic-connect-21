UPDATE public.cotacoes
SET email_solicitante = 'Jesusmatheus8917@gmail.com'
WHERE numero = 'COT-20260528-141222375-095'
  AND email_solicitante = 'Jesusmatheus8917gmail.com';

UPDATE public.contratos
SET cliente_email = 'Jesusmatheus8917@gmail.com'
WHERE numero = 'CTR-20260528171456-3LA6ZH'
  AND cliente_email = 'Jesusmatheus8917gmail.com';

UPDATE public.associados
SET email = 'Jesusmatheus8917@gmail.com'
WHERE id = 'ef7a943b-61e8-4bf5-bd84-c77695d7d9af'
  AND email = 'Jesusmatheus8917gmail.com';

INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao)
VALUES (
  'editar',
  'cotacoes',
  'cotacoes',
  '5d9a4715-5991-4a44-bab5-2a1f5a669e92'::uuid,
  '[SANEAMENTO_EMAIL] Corrigido email "Jesusmatheus8917gmail.com" -> "Jesusmatheus8917@gmail.com" em cotacao COT-20260528-141222375-095, contrato CTR-20260528171456-3LA6ZH e associado MATHEUS ARTHUR JESUS PEREIRA COSTA. Reprocesar autentique-create em seguida.'
);