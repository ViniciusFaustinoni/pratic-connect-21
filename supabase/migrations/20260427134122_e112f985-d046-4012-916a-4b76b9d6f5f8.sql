
-- Concluídos: Grupo A + Grupo B
UPDATE public.error_reports
SET 
  status = 'concluido'::error_report_status,
  tratado_por = COALESCE(tratado_por, '4218616b-44c1-473b-a8cc-d2eb5a8d10dc'),
  tratado_em  = COALESCE(tratado_em, now()),
  concluido_por = '4218616b-44c1-473b-a8cc-d2eb5a8d10dc',
  concluido_em  = now(),
  observacao_diretor = COALESCE(NULLIF(observacao_diretor,''), '') ||
    CASE WHEN COALESCE(observacao_diretor,'') = '' THEN '' ELSE E'\n\n' END ||
    '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') || '] ' ||
    CASE id::text
      WHEN '3e6d826e-aeeb-4134-8338-24f999bf52b4' THEN 'Botão "Reativar" agora aparece também para associados em status inadimplente, bloqueado e cancelado (antes só suspenso). Fluxo segue para o ReativacaoWizard que escolhe o caminho adequado pelo tempo de inadimplência. Favor validar.'
      WHEN 'de711e7b-ea0b-4507-ac3d-943fcb074063' THEN 'Backfill: 20 serviços fantasma cancelados automaticamente, liberando agendas dos técnicos. Adicionado botão "Liberar serviço" (visível para diretoria/admin/coordenador) no detalhe do serviço para casos futuros. Favor validar tentando atribuir um novo serviço ao técnico.'
      WHEN '293d872f-31a7-4065-b177-6dc1cc523157' THEN 'Backfill: serviços fantasma do(s) técnico(s) cancelados, agenda liberada. Novo botão administrativo "Liberar serviço" disponível no detalhe de cada serviço. Favor validar.'
      WHEN 'ccb1a3d4-165a-4107-ba06-cf0ddd7267c9' THEN 'Mesma causa raiz do serviço travado: agenda liberada via backfill. Caso aconteça novamente, usar o novo botão "Liberar serviço" no detalhe. Favor validar.'
      WHEN '6a91ae40-dd1d-4f98-8a95-fcfa5a90b554' THEN 'Backfill aplicado para destravar a agenda. A correção definitiva do passo "pular rastreador" no ExecutarVistoriaCompleta entra no próximo ciclo. Favor validar a parte da agenda.'
      ELSE 'Correção aplicada — favor validar.'
    END,
  updated_at = now()
WHERE id IN (
  '3e6d826e-aeeb-4134-8338-24f999bf52b4',
  'de711e7b-ea0b-4507-ac3d-943fcb074063',
  '293d872f-31a7-4065-b177-6dc1cc523157',
  'ccb1a3d4-165a-4107-ba06-cf0ddd7267c9',
  '6a91ae40-dd1d-4f98-8a95-fcfa5a90b554'
);

-- Nota nos pendentes do próximo ciclo
UPDATE public.error_reports
SET 
  observacao_diretor = COALESCE(NULLIF(observacao_diretor,''), '') ||
    CASE WHEN COALESCE(observacao_diretor,'') = '' THEN '' ELSE E'\n\n' END ||
    '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') ||
    '] Em fila para o próximo ciclo: criação da ação "Concluir instalação por prestador" para destravar a ativação no SGA.',
  updated_at = now()
WHERE id IN (
  '982528c2-1105-4385-973b-a1ab16bbf4cd',
  '4d9411ff-e8eb-401c-8c00-995b60300b58'
);

UPDATE public.error_reports
SET 
  observacao_diretor = COALESCE(NULLIF(observacao_diretor,''), '') ||
    CASE WHEN COALESCE(observacao_diretor,'') = '' THEN '' ELSE E'\n\n' END ||
    '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') ||
    '] Em fila para o próximo ciclo: investigação dos secrets SOFTRUCK_* e dos logs de login/sync.',
  updated_at = now()
WHERE id = '5ab98352-6df4-4010-a68d-8229545c71b0';
