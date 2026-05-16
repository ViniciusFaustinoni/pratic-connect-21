-- Backfill controlado: destravar COT-20260516-101252395-551 (Leonardo)
-- Caso: autovistoria antecipada aprovada pelo Cadastro, mas veículo exige
-- rastreador (FIPE 36k > 30k carro) e a instalação física nunca foi agendada.
-- Veículo ficou em instalacao_pendente sem caminho de saída.
-- Ação: reverter cadastro_aprovado (mantém R/F liberado), reabrir status
-- para aguardando_aprovacao_cadastro. O cliente verá a etapa Instalação no
-- link público após o patch da UI; após agendar, Cadastro aprova novamente.

DO $$
DECLARE
  v_cotacao_id uuid := '2310279e-851a-4787-872e-5d2a9cb0a832';
  v_contrato_id uuid := '0cf41fac-575d-472e-b6ab-9fe24f7b849b';
BEGIN
  UPDATE public.contratos
     SET cadastro_aprovado = false,
         aprovado_por = NULL,
         aprovado_em = NULL,
         updated_at = now()
   WHERE id = v_contrato_id;

  UPDATE public.cotacoes
     SET status_contratacao = 'aguardando_aprovacao_cadastro',
         updated_at = now()
   WHERE id = v_cotacao_id;

  INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao, usuario_id)
  VALUES (
    'editar',
    'contratos',
    'contratos',
    v_contrato_id,
    'Backfill: COT-20260516-101252395-551 destravado. Autovistoria antecipada havia liberado R/F mas o veículo exige rastreador e a instalação física não foi agendada. cadastro_aprovado revertido para que o cliente agende a instalação pelo link público; R/F mantido.',
    NULL
  );
END $$;