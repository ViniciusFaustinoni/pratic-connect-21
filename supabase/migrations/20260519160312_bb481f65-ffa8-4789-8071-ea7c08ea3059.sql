-- =============================================================================
-- 1) Campos novos no link do prestador para captura de IMEI na conclusão
-- =============================================================================
ALTER TABLE public.instalacao_prestador_links
  ADD COLUMN IF NOT EXISTS rastreador_imei text,
  ADD COLUMN IF NOT EXISTS dispensa_rastreador boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.instalacao_prestador_links.rastreador_imei IS
  'IMEI do rastreador físico informado pelo prestador na conclusão da instalação. Obrigatório quando dispensa_rastreador=false e o veículo exige rastreador (Diesel / FIPE>=30k carro / FIPE>=9k moto).';

COMMENT ON COLUMN public.instalacao_prestador_links.dispensa_rastreador IS
  'Marcado pelo Monitoramento quando a atribuição é apenas de vistoria (sem instalação de rastreador). Quando true, a edge concluir-instalacao-prestador não exige IMEI.';

-- =============================================================================
-- 2) SANEAMENTO PONTUAL — CASSIO LAZARO LIRIO CORREA DE OLIVEIRA (LMX5A90)
--    Reverte o efeito colateral da migration 20260516220629 (FRENTE 5 backfill)
--    que rebobinou indevidamente este contrato (instalação real feita por
--    prestador externo em 30/04/2026, IMEI 862667083450315 / Softruck).
-- =============================================================================
DO $saneamento$
DECLARE
  v_veiculo_id   uuid := '3a05032d-8a13-42b7-a34d-b2e3bdd44455'::uuid;  -- LMX5A90
  v_associado_id uuid := '5d907065-f6ce-4220-879c-d27d6faa5b9e'::uuid;  -- CASSIO
  v_contrato_id  uuid := '3388240f-b3d1-44e1-996a-fd2a891d912e'::uuid;
  v_instalacao_id uuid := '3ae909be-7a02-466d-ac16-81e2dee7cc6e'::uuid;
  v_servico_id   uuid := 'cc991c24-7c4a-4c35-ae02-33e18482773e'::uuid;
  v_rastreador_id uuid := '71fa60bb-4da7-47ae-9423-2b10a78cd2a7'::uuid; -- IMEI 862667083450315
  v_concluida_em timestamptz := '2026-04-30 19:04:17.22519+00'::timestamptz;
BEGIN
  -- (a) Vincular o rastreador físico ao veículo/associado (Softruck já tem o equipamento ativo desde 04/04)
  UPDATE public.rastreadores
     SET veiculo_id   = v_veiculo_id,
         associado_id = v_associado_id,
         status       = 'instalado',
         updated_at   = now()
   WHERE id = v_rastreador_id
     AND status = 'estoque';

  -- (b) Restaurar a instalação como concluída ANTES de promover o veículo a ativo
  --     (assim o trg_guard_instalacao_concluida_exige_rastreador é satisfeito)
  UPDATE public.instalacoes
     SET status          = 'concluida',
         concluida_em    = v_concluida_em,
         data_agendada   = v_concluida_em::date,
         rastreador_id   = v_rastreador_id,
         imei_rastreador = '862667083450315',
         updated_at      = now()
   WHERE id = v_instalacao_id;

  -- (c) Restaurar o serviço de instalação
  UPDATE public.servicos
     SET status        = 'concluida',
         concluida_em  = v_concluida_em,
         data_agendada = v_concluida_em::date,
         rastreador_id = v_rastreador_id,
         observacoes   = COALESCE(observacoes, '') ||
                         E'\n[19/05/2026] Reabertura indevida do dia 16/05 (backfill mass) revertida. Instalação real concluída por SHALOM CAR em 30/04 com IMEI 862667083450315 (Softruck).',
         updated_at    = now()
   WHERE id = v_servico_id;

  -- (d) Reativar o veículo (rastreador já vinculado satisfaz o guard)
  UPDATE public.veiculos
     SET status               = 'ativo',
         cobertura_total      = true,
         cobertura_roubo_furto = true,
         cobertura_suspensa   = false,
         updated_at           = now()
   WHERE id = v_veiculo_id;

  -- (e) Reativar contrato (mantém data_ativacao original de 07/05)
  UPDATE public.contratos
     SET status     = 'ativo',
         updated_at = now()
   WHERE id = v_contrato_id;

  -- (f) Reativar associado
  UPDATE public.associados
     SET status     = 'ativo',
         updated_at = now()
   WHERE id = v_associado_id;

  -- (g) Histórico
  INSERT INTO public.associados_historico (associado_id, contrato_id, tipo, descricao)
  VALUES (
    v_associado_id, v_contrato_id, 'observacao_adicionada',
    'SANEAMENTO MANUAL (caso CASSIO LAZARO / LMX5A90): a migration 20260516220629 (FRENTE 5 backfill) reverteu indevidamente esta adesão porque o link público do prestador não preenchia instalacoes.rastreador_id, fazendo o filtro "rastreador_id IS NULL" capturar instalações reais. Rastreador físico IMEI 862667083450315 (Softruck) foi vinculado ao veículo, instalação restaurada como concluída em 30/04/2026, contrato e veículo reativados. A partir desta migration, o link do prestador exige IMEI na conclusão.'
  );

  -- (h) Auditoria explícita do saneamento
  INSERT INTO public.logs_auditoria (
    usuario_nome, acao, modulo, descricao, registro_id, tabela,
    dados_novos
  ) VALUES (
    'Sistema (saneamento)', 'reativar', 'associados',
    'Saneamento do caso CASSIO LAZARO / LMX5A90 — instalação real do prestador restaurada e rastreador IMEI 862667083450315 vinculado ao veículo.',
    v_associado_id, 'associados',
    jsonb_build_object(
      'veiculo_id', v_veiculo_id,
      'contrato_id', v_contrato_id,
      'instalacao_id', v_instalacao_id,
      'rastreador_id', v_rastreador_id,
      'imei', '862667083450315',
      'origem_problema', 'migration 20260516220629 backfill'
    )
  );
END;
$saneamento$;