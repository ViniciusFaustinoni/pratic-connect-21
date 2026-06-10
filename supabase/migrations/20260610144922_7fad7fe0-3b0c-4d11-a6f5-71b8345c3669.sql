-- Termo de Substituição (codigo='SUB'): adicionar bloco "VEÍCULO SUBSTITUÍDO"
-- antes de "DADOS DO VEÍCULO" e reforçar cláusula do checkbox com placa + modelo
-- anteriores, deixando explícito qual carro está saindo e qual está entrando.

UPDATE public.documento_templates
SET
  conteudo = REPLACE(
    REPLACE(
      conteudo,
      -- 1) Cláusula do checkbox: troca para texto autoexplicativo
      '{{operacao.substituicao_placa}} Subs. Placa (o veíc. terá a cob. do PSM cancelada) {{substituicao.placa_anterior}}',
      '{{operacao.substituicao_placa}} Subs. Placa &mdash; veículo <strong>{{substituicao.placa_anterior}}</strong> ({{substituicao.modelo_anterior}}) terá a cobertura do PSM <strong>cancelada</strong>'
    ),
    -- 2) Insere o bloco "VEÍCULO SUBSTITUÍDO" ANTES do bloco "DADOS DO VEÍCULO"
    --    e renomeia o bloco existente para "VEÍCULO NOVO (Substituto)"
    '<p><strong>DADOS DO VEÍCULO</strong></p>',
    '<p><br></p><p><strong>VEÍCULO SUBSTITUÍDO (Cobertura Cancelada)</strong></p>'
    || '<table style="min-width: 454px;"><colgroup><col style="min-width: 25px;"><col style="width: 429px;"></colgroup><tbody>'
    || '<tr><td colspan="1" rowspan="1"><p><strong>Placa:</strong></p></td><td colspan="1" rowspan="1" colwidth="429"><p>{{substituicao.placa_anterior}}</p></td></tr>'
    || '<tr><td colspan="1" rowspan="1"><p><strong>Marca/Modelo:</strong></p></td><td colspan="1" rowspan="1" colwidth="429"><p>{{substituicao.modelo_anterior}}</p></td></tr>'
    || '<tr><td colspan="1" rowspan="1"><p><strong>Valor FIPE:</strong></p></td><td colspan="1" rowspan="1" colwidth="429"><p>{{substituicao.fipe_anterior}}</p></td></tr>'
    || '</tbody></table><p><br></p>'
    || '<p><strong>VEÍCULO NOVO (Substituto)</strong></p>'
  ),
  versao = versao + 1,
  updated_at = now()
WHERE codigo = 'SUB' AND is_default_substituicao = true;