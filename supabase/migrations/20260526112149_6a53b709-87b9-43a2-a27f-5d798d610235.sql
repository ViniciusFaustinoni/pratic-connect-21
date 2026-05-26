INSERT INTO whatsapp_meta_templates (nome, status, disparo_habilitado, categoria, idioma, corpo, variaveis_exemplo)
VALUES (
  'd_6_lembrete_desconto_v2',
  'PENDING',
  true,
  'UTILITY',
  'pt_BR',
  E'O PRAZO PARA DESCONTO DE 5% É ATÉ AMANHÃ!! NÃO PERCA! 🤩🚨\n\nBom dia Sr(a) {{1}}, tudo bem? Passando para informar que o seu boleto vence em {{2}} e o(a) Sr(a) consegue efetuar o PAGAMENTO COM 5% DE DESCONTO ATÉ AMANHÃ\n\nEstou enviando abaixo, para copiar e colar, a linha digitável para realizar o pagamento junto ao banco 👇\n\n{{3}}\n\nAtenciosamente, Praticcar 💙❤️',
  '["João", "28/05/2026", "23793.38128 60082.345678 90000.123456 7 98760000018990"]'::jsonb
);

UPDATE whatsapp_meta_templates
SET disparo_habilitado = false
WHERE nome = 'd_6_lembrete_desconto_v1';