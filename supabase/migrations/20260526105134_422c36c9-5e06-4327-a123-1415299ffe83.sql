
-- Cria v3 (5 vars, sem modelo)
INSERT INTO public.whatsapp_meta_templates (
  nome, categoria, idioma, status, disparo_habilitado,
  header_tipo, corpo, rodape, variaveis_exemplo, enviar_por_email
) VALUES (
  'emissao_boleto_gerado_v3',
  'UTILITY',
  'pt_BR',
  'PENDING',
  true,
  'none',
  E'Olá {{1}}, aqui é da PRATIC CAR, tudo bem? 😊\n\nEstamos enviando o boleto QUE JÁ ESTÁ disponível, referente a proteção do veículo:\nPlaca: {{2}}\n\nCom vencimento em: {{3}}\n\nNo valor de: {{4}}.\n\n⚠️ Caso já tenha efetuado o pagamento, favor desconsiderar.\n\nEstou enviando abaixo, para copiar e colar, a linha digitável para realizar o pagamento junto ao banco 👇\n\n{{5}}',
  NULL,
  '{"1":"João","2":"ABC-1234","3":"20/03/2026","4":"R$ 150,00","5":"23793.38128 60000.000003 00000.000404 1 84340000015000"}'::jsonb,
  true
)
ON CONFLICT (nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  idioma = EXCLUDED.idioma,
  corpo = EXCLUDED.corpo,
  rodape = EXCLUDED.rodape,
  variaveis_exemplo = EXCLUDED.variaveis_exemplo,
  header_tipo = EXCLUDED.header_tipo,
  disparo_habilitado = true,
  updated_at = now();

-- Desativa disparo do v2 (preserva histórico e status Meta)
UPDATE public.whatsapp_meta_templates
   SET disparo_habilitado = false,
       updated_at = now()
 WHERE nome = 'emissao_boleto_gerado_v2';
