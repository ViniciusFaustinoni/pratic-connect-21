
UPDATE public.whatsapp_meta_templates
   SET corpo = E'Olá {{1}}, aqui é da PRATIC CAR, tudo bem? 😊\n\nEstamos enviando o boleto QUE JÁ ESTÁ disponível, referente a proteção do veículo:\nPlaca: {{2}}\n\nCom vencimento em: {{3}}\n\nNo valor de: {{4}}.\n\n⚠️ Caso já tenha efetuado o pagamento, favor desconsiderar.\n\nEstou enviando abaixo, para copiar e colar, a linha digitável para realizar o pagamento junto ao banco 👇\n\n{{5}}\n\nQualquer dúvida estamos à disposição.',
       updated_at = now()
 WHERE nome = 'emissao_boleto_gerado_v3';
