-- Backfill: materializa fotos do prestador como vistoria + vistoria_fotos canônicas
-- Apenas para links já concluídos cujo instalacao_id ainda não tem vistoria.
DO $$
DECLARE
  link_rec RECORD;
  inst_rec RECORD;
  new_vistoria_id UUID;
  foto_pair RECORD;
  fotos_inseridas INT;
BEGIN
  FOR link_rec IN
    SELECT l.id AS link_id, l.instalacao_id, l.fotos_vistoria, l.checklist_data,
           l.assinatura_url, l.concluida_em, l.created_at AS link_created_at
    FROM public.instalacao_prestador_links l
    WHERE l.status = 'concluida'
      AND l.fotos_vistoria IS NOT NULL
      AND l.fotos_vistoria <> '{}'::jsonb
      AND NOT EXISTS (
        SELECT 1 FROM public.vistorias v WHERE v.instalacao_id = l.instalacao_id
      )
  LOOP
    SELECT i.id, i.contrato_id, i.associado_id, i.cotacao_id,
           i.cep, i.logradouro, i.numero, i.complemento, i.bairro, i.cidade, i.uf,
           i.endereco_latitude, i.endereco_longitude, i.imei_rastreador,
           i.quilometragem, i.created_at, i.concluida_em
    INTO inst_rec
    FROM public.instalacoes i
    WHERE i.id = link_rec.instalacao_id;

    IF inst_rec.contrato_id IS NULL THEN
      RAISE NOTICE 'Backfill: instalação % sem contrato_id, ignorando', link_rec.instalacao_id;
      CONTINUE;
    END IF;

    INSERT INTO public.vistorias (
      instalacao_id, contrato_id, associado_id, cotacao_id,
      modalidade, origem, status,
      iniciada_em, concluida_em,
      endereco_cep, endereco_logradouro, endereco_numero, endereco_bairro,
      endereco_cidade, endereco_estado, endereco_latitude, endereco_longitude,
      imei_rastreador, km_atual,
      dados_parciais, assinatura_documento_url
    ) VALUES (
      inst_rec.id, inst_rec.contrato_id, inst_rec.associado_id, inst_rec.cotacao_id,
      'presencial', 'prestador', 'concluida',
      COALESCE(link_rec.link_created_at, inst_rec.created_at),
      COALESCE(link_rec.concluida_em, inst_rec.concluida_em, now()),
      inst_rec.cep, inst_rec.logradouro, inst_rec.numero, inst_rec.bairro,
      inst_rec.cidade, inst_rec.uf, inst_rec.endereco_latitude, inst_rec.endereco_longitude,
      inst_rec.imei_rastreador, inst_rec.quilometragem,
      jsonb_build_object('checklist_data', link_rec.checklist_data, 'origem_link', link_rec.link_id, 'backfill', true),
      link_rec.assinatura_url
    )
    RETURNING id INTO new_vistoria_id;

    fotos_inseridas := 0;
    FOR foto_pair IN
      SELECT key AS tipo, value::text AS arquivo_url
      FROM jsonb_each_text(link_rec.fotos_vistoria)
      WHERE value IS NOT NULL AND length(value::text) > 0
    LOOP
      INSERT INTO public.vistoria_fotos (vistoria_id, tipo, arquivo_url, visivel_cliente)
      VALUES (new_vistoria_id, foto_pair.tipo, foto_pair.arquivo_url, true);
      fotos_inseridas := fotos_inseridas + 1;
    END LOOP;

    RAISE NOTICE 'Backfill: vistoria % criada para instalação %, % fotos inseridas',
                 new_vistoria_id, link_rec.instalacao_id, fotos_inseridas;
  END LOOP;
END $$;