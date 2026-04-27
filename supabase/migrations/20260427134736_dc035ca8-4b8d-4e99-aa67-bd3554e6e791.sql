
UPDATE public.error_reports
SET status = 'concluido',
    concluido_em = now(),
    observacao_diretor = COALESCE(observacao_diretor || E'\n', '') ||
      '[' || to_char(now(),'DD/MM/YYYY HH24:MI') || '] Implementado botão "Concluir (prestador)" no card do veículo do associado, permitindo que admin/diretor/coordenador feche manualmente instalações executadas por prestadores externos (com justificativa obrigatória), liberando a ativação na SGA.'
WHERE id IN (
  '4d9411ff-e8eb-401c-8c00-995b60300b58',
  '982528c2-1105-4385-973b-a1ab16bbf4cd'
);

UPDATE public.error_reports
SET observacao_diretor = COALESCE(observacao_diretor || E'\n', '') ||
  '[' || to_char(now(),'DD/MM/YYYY HH24:MI') || '] Diagnóstico em andamento: secrets SOFTRUCK_USERNAME/PASSWORD/ENTERPRISE_ID/PUBLIC_KEY presentes; sem logs recentes nas edge functions softruck-*. Necessário reproduzir o cenário (associado e veículo específicos) para investigar se a falha é de credenciais, sincronização de IMEI ou criação de usuário na plataforma Rede Veículos. Permanece em tratamento.'
WHERE id = '5ab98352-6df4-4010-a68d-8229545c71b0';
