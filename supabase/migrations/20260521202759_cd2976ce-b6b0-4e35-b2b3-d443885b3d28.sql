ALTER TABLE public.documento_templates
  ADD COLUMN IF NOT EXISTS is_default_substituicao boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_documento_templates_default_substituicao
  ON public.documento_templates (is_default_substituicao)
  WHERE is_default_substituicao = true AND ativo = true;

DO $$
DECLARE
  v_origem RECORD;
  v_clausula text;
  v_conteudo_novo text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.documento_templates WHERE codigo = 'AF1-SUB') THEN
    RAISE NOTICE 'Template AF1-SUB já existe — pulando criação';
    RETURN;
  END IF;

  SELECT id, categoria_id, conteudo, variaveis, config_layout, cabecalho_html, rodape_html,
         requer_assinatura, document_type_id
    INTO v_origem
    FROM public.documento_templates
   WHERE is_default_autentique = true AND ativo = true
   ORDER BY updated_at DESC
   LIMIT 1;

  IF v_origem.id IS NULL THEN
    RAISE EXCEPTION 'Nenhum template com is_default_autentique=true encontrado para clonar';
  END IF;

  v_clausula :=
    '<p><br></p>' ||
    '<p style="text-align: center;"><strong>CLÁUSULA — SUBSTITUIÇÃO DE VEÍCULO</strong></p>' ||
    '<p>O ASSOCIADO DECLARA, para todos os fins de direito, estar ciente e de pleno acordo que ' ||
    'a presente adesão decorre de SUBSTITUIÇÃO DE VEÍCULO e substitui integralmente a proteção ' ||
    'anteriormente vigente sobre o veículo de placa <strong>{{substituicao.placa_anterior}}</strong> ' ||
    '(<strong>{{substituicao.modelo_anterior}}</strong>), cuja cobertura será ' ||
    '<strong>INTEGRALMENTE CANCELADA</strong> na data de início desta nova adesão, ficando o ' ||
    'veículo anterior <strong>SEM QUALQUER COBERTURA ASSOCIATIVA</strong> a partir desse momento.</p>' ||
    '<p>A presente assinatura formaliza essa ciência, autoriza o cancelamento da proteção do ' ||
    'veículo anterior e isenta a associação de qualquer responsabilidade por eventos ocorridos com ' ||
    'aquele veículo após a data de início desta substituição.</p>';

  v_conteudo_novo := v_origem.conteudo || v_clausula;

  INSERT INTO public.documento_templates (
    categoria_id, nome, codigo, descricao, versao, conteudo,
    variaveis, config_layout, cabecalho_html, rodape_html,
    ativo, requer_assinatura, is_default_autentique, is_default_substituicao,
    document_type_id, status
  ) VALUES (
    v_origem.categoria_id,
    'Termo de Substituição',
    'AF1-SUB',
    'Termo enviado via Autentique quando a cotação é de SUBSTITUIÇÃO DE VEÍCULO. Conteúdo idêntico ao Termo de Filiação acrescido da cláusula de ciência sobre cancelamento do veículo anterior.',
    1,
    v_conteudo_novo,
    COALESCE(v_origem.variaveis, '[]'::jsonb),
    COALESCE(v_origem.config_layout, '{}'::jsonb),
    v_origem.cabecalho_html,
    v_origem.rodape_html,
    true,
    COALESCE(v_origem.requer_assinatura, true),
    false,
    true,
    v_origem.document_type_id,
    'active'::template_status
  );

  RAISE NOTICE 'Template AF1-SUB criado a partir de AF1';
END $$;