INSERT INTO whatsapp_meta_templates (nome, categoria, idioma, status, disparo_habilitado, corpo, variaveis_exemplo)
VALUES (
  'd5_ultimo_dia_sem_revistoria_v2',
  'UTILITY',
  'pt_BR',
  'PENDING',
  true,
  E'HOJE SERÁ O ÚLTIMO DIA PARA EFETUAR O PAGAMENTO SEM A REVISTORIA! ⚠️\n\n🚨🚗🛵\n\nCorra e efetue o PAGAMENTO ATÉ HOJE SEM A REALIZAÇÃO DA REVISTORIA!!!\n\n😱😨\n\n(Lembrando que o seu vencimento foi {{1}}.)\n\nSeu veículo permanece desprotegido, corra e efetue o pagamento hoje mesmo! ✅\n\n⚠️ Caso já tenha efetuado o pagamento, favor desconsiderar.\n\nSEGUE O CÓDIGO DE BARRAS ATUALIZADO ❗',
  '{"1":"20/03/2026"}'::jsonb
)
ON CONFLICT (nome) DO UPDATE SET disparo_habilitado = true, status = 'PENDING', corpo = EXCLUDED.corpo;

UPDATE whatsapp_meta_templates
SET disparo_habilitado = false
WHERE nome = 'd5_ultimo_dia_sem_revistoria_v1';