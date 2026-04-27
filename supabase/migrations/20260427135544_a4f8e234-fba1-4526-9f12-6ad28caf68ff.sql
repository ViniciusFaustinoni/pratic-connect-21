
UPDATE public.error_reports
SET status = 'concluido',
    concluido_em = now(),
    observacao_diretor = COALESCE(observacao_diretor || E'\n', '') ||
      '[' || to_char(now(),'DD/MM/YYYY HH24:MI') || '] CAUSA RAIZ corrigida: o hook useAtivarRastreadorPlataforma (usado pelo botão "Ativar" em Detalhe do Associado e nos serviços de campo) tratava apenas a plataforma "softruck", ignorando "rede_veiculos". Por isso a função vincularClienteVeiculo nunca era invocada — não havia criação do cliente na plataforma e portanto nenhum login/senha era enviado ao associado. Análise confirmou nos logs (rastreadores_api_logs): 229 chamadas de obterStatusCliente, ZERO chamadas de vincularClienteVeiculo. Correção: hook agora invoca rede-veiculos-vincular-cliente quando plataforma = rede_veiculos; botão "Ativar" no AssociadoDetalhe passa a aparecer também para rastreadores rede_veiculos sem rede_veiculos_cliente_id. Após esta ativação a plataforma criará o cliente e enviará credenciais por e-mail; dados de telemetria começarão a popular.'
WHERE id = '5ab98352-6df4-4010-a68d-8229545c71b0';
