
UPDATE public.associados
   SET status = 'aguardando_instalacao'::status_associado,
       updated_at = now()
 WHERE id = '159a0f0d-e7bf-4686-b6ee-a4cc75f76edb'
   AND status = 'em_analise';

INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao, dados_novos)
VALUES ('editar', 'monitoramento', 'associados', '159a0f0d-e7bf-4686-b6ee-a4cc75f76edb',
        'Hotfix: associados.status revertido de em_analise para aguardando_instalacao (rebobinamento pós-instalação travou ativar-associado) — KQB4683 / ALAN THIAGO DUARTE LEAL',
        jsonb_build_object('status', 'aguardando_instalacao', 'motivo', 'destravar ativar-associado'));
