-- [ROLLBACK_TROCA_KPJ4994] Anderson da Silva Esteves — devolver troca para fila do Monitoramento
-- Motivo: religação de R/F sem rastreador em Carro FIPE>=R$30k violou regra canônica.
-- Mantém transferência do veículo, contrato novo e cancelamento do contrato anterior (etapas
-- bloqueantes legítimas). Reverte: aprovação Monitoramento, marca de efetivação, R/F religado
-- cegamente e contrato 'ativo' marcado direto sem ativar-associado.

-- 1) Solicitação: efetivada -> aguardando_monitoramento
UPDATE public.solicitacoes_troca_titularidade
SET status = 'aguardando_monitoramento',
    aprovado_monitoramento_em = NULL,
    aprovado_monitoramento_por = NULL,
    efetivada_em = NULL,
    observacao_monitoramento = COALESCE(observacao_monitoramento || E'\n', '')
      || '[ROLLBACK_MANUAL_DIRETORIA 2026-05-26] Aprovação revertida pela Diretoria — religação de R/F sem rastreador em Carro FIPE>=R$30k violou regra canônica. Reavaliar instalação de rastreador / vistoria.',
    updated_at = now()
WHERE id = '69498d3e-63ba-42d7-8b14-93ccebeae47a'
  AND status = 'efetivada';

-- 2) Veículo: desligar R/F religado indevidamente (Carro >=R$30k sem rastreador)
UPDATE public.veiculos
SET cobertura_roubo_furto = false,
    updated_at = now()
WHERE id = 'd53acb36-0e8c-4683-8537-0651c724d454'
  AND cobertura_roubo_furto = true;

-- 3) Contrato novo: ativo -> assinado, aprovado_em = NULL (mantém cadastro_aprovado=true,
--    pois o trg_protege_cadastro_aprovado impede regressão e a aprovação de Cadastro
--    da Troca é legítima)
UPDATE public.contratos
SET status = 'assinado',
    aprovado_em = NULL,
    updated_at = now()
WHERE id = '86ea58cb-cee4-4f72-bd0e-9e7fad63f834'
  AND status = 'ativo';

-- 4) Log de auditoria
INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao, dados_anteriores, dados_novos)
VALUES (
  'editar',
  'monitoramento',
  'solicitacoes_troca_titularidade',
  '69498d3e-63ba-42d7-8b14-93ccebeae47a',
  '[ROLLBACK_TROCA_KPJ4994] Solicitação devolvida para fila de aprovação do Monitoramento. Motivo: religação de R/F em Carro FIPE>=R$30k sem rastreador vinculado violou regra canônica. Mantidas etapas bloqueantes (transferência do veículo, contrato novo, cancelamento do contrato anterior); revertidos: aprovado_monitoramento_em, efetivada_em, cobertura_roubo_furto (veiculo d53acb36) e contrato 86ea58cb (ativo->assinado, aprovado_em=NULL).',
  jsonb_build_object('solicitacao_status','efetivada','contrato_status','ativo','cobertura_roubo_furto',true),
  jsonb_build_object('solicitacao_status','aguardando_monitoramento','contrato_status','assinado','cobertura_roubo_furto',false)
);