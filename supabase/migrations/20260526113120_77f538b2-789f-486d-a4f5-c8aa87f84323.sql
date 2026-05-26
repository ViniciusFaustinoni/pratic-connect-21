
INSERT INTO public.whatsapp_meta_templates (nome, categoria, idioma, status, header_tipo, corpo, variaveis_exemplo, disparo_habilitado)
VALUES (
  'd1_a_d4_boleto_vencido_v2',
  'UTILITY',
  'pt_BR',
  'PENDING',
  'NONE',
  E'SEU BOLETO ESTÁ VENCIDO!! 🚨🚨🚨\n\nBom dia Sr(a) {{1}}, tudo bem?\n\nSeu boleto venceu em {{2}}.\n\nCorra e efetue o pagamento ainda hoje, para que não seja necessário a realização da revistoria!\n\nLEMBRANDO QUE O SEU VEÍCULO JÁ SE ENCONTRA DESPROTEGIDO! 🗣️😞\n\nSEGUE O CÓDIGO DE BARRAS ATUALIZADO!\n\n⚠️ Caso já tenha efetuado o pagamento, favor desconsiderar.',
  '{"1":"João","2":"20/03/2026"}'::jsonb,
  true
)
ON CONFLICT (nome) DO UPDATE SET corpo = EXCLUDED.corpo, variaveis_exemplo = EXCLUDED.variaveis_exemplo, disparo_habilitado = true;

UPDATE public.whatsapp_meta_templates SET disparo_habilitado = false WHERE nome = 'd1_a_d4_boleto_vencido_v1';
