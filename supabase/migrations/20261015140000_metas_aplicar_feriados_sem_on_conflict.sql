-- ERR-SDIOGS (relato 1964) — /vendas/equipe-comercial → rpc metas_aplicar → 42P10
-- "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- feriados_comerciais deixou de ser tabela: virou VIEW sobre calendario_dias, com
-- trigger INSTEAD OF (fn_feriados_comerciais_gravar). View não tem índice único,
-- então o "on conflict (data, coalesce(regiao,'')) do nothing" de metas_aplicar
-- quebra toda aplicação de sugestão que traga feriados.
--
-- A unicidade agora mora em calendario_dias (ux_calendario_dia_alcance), e o trigger
-- converte a colisão em 23505. Mantemos o "do nothing" capturando unique_violation
-- num sub-bloco. Demais trechos da função ficam idênticos.

create or replace function public.metas_aplicar(p_leitura_id uuid, p_sugestao jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid(); v_leitura public.metas_leituras; r jsonb;
  v_regioes int := 0; v_feriados int := 0; v_metas int := 0; v_campanha uuid; v_out jsonb;
begin
  if v_uid is null then raise exception 'não autenticado' using errcode = '42501'; end if;
  if not public.pode_gerir_metas(v_uid) then raise exception 'sem permissão para gerir metas' using errcode = '42501'; end if;
  if p_sugestao is null or jsonb_typeof(p_sugestao) <> 'object' then raise exception 'sugestão vazia' using errcode = '22023'; end if;
  if p_leitura_id is not null then
    select * into v_leitura from public.metas_leituras where id = p_leitura_id for update;
    if not found then raise exception 'leitura não encontrada' using errcode = 'P0002'; end if;
    if v_leitura.status = 'aplicada' then return coalesce(v_leitura.resultado, '{}'::jsonb) || jsonb_build_object('ja_aplicada', true); end if;
    if v_leitura.status = 'descartada' then raise exception 'leitura descartada' using errcode = '22023'; end if;
  end if;
  for r in select * from jsonb_array_elements(coalesce(p_sugestao->'regioes', '[]'::jsonb)) loop
    insert into public.metas_regiao (ano, mes, regiao, meta, responsavel_id, criado_por, atualizado_por, leitura_id)
    values ((r->>'ano')::int, (r->>'mes')::int, upper(trim(r->>'regiao')), (r->>'meta')::int, nullif(r->>'responsavel_id', '')::uuid, v_uid, v_uid, p_leitura_id)
    on conflict (ano, mes, regiao) do update set meta = excluded.meta,
      responsavel_id = coalesce(excluded.responsavel_id, public.metas_regiao.responsavel_id),
      atualizado_por = v_uid, leitura_id = excluded.leitura_id, updated_at = now();
    v_regioes := v_regioes + 1;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_sugestao->'feriados', '[]'::jsonb)) loop
    -- feriados_comerciais é view (INSTEAD OF → calendario_dias): sem ON CONFLICT.
    begin
      insert into public.feriados_comerciais (data, nome, regiao, criado_por)
      values ((r->>'data')::date, trim(r->>'nome'), nullif(upper(trim(coalesce(r->>'regiao', ''))), ''), v_uid);
    exception when unique_violation then
      null; -- feriado já está no calendário
    end;
    v_feriados := v_feriados + 1;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_sugestao->'metas_consultores', '[]'::jsonb)) loop
    insert into public.metas_vendas (vendedor_id, ano, mes, meta_contratos)
    values ((r->>'vendedor_id')::uuid, (r->>'ano')::int, (r->>'mes')::int, (r->>'meta')::int)
    on conflict (vendedor_id, mes, ano) do update set meta_contratos = excluded.meta_contratos, updated_at = now();
    v_metas := v_metas + 1;
  end loop;
  if jsonb_typeof(p_sugestao->'campanha') = 'object' then
    insert into public.campanhas_vendas (nome, inicio, fim, regiao, premios, status, texto_original, leitura_id, criado_por)
    values (trim(p_sugestao->'campanha'->>'nome'), (p_sugestao->'campanha'->>'inicio')::date, (p_sugestao->'campanha'->>'fim')::date,
            nullif(upper(trim(coalesce(p_sugestao->'campanha'->>'regiao', ''))), ''), coalesce(p_sugestao->'campanha'->'premios', '[]'::jsonb),
            'ativa', p_sugestao->'campanha'->>'texto_original', p_leitura_id, v_uid)
    returning id into v_campanha;
  end if;
  v_out := jsonb_build_object('regioes', v_regioes, 'feriados', v_feriados, 'metas_consultores', v_metas, 'campanha_id', v_campanha, 'ja_aplicada', false);
  if p_leitura_id is not null then
    update public.metas_leituras set status = 'aplicada', aplicada_por = v_uid, aplicada_em = now(), resultado = v_out, sugestao = p_sugestao where id = p_leitura_id;
  end if;
  return v_out;
end;
$function$;
