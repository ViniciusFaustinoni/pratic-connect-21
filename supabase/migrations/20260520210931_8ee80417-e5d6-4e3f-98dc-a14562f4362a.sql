UPDATE solicitacoes_troca_titularidade
SET status='cancelada',
    motivo_reprovacao='Cancelamento manual solicitado pela diretoria',
    reprovado_em=now()
WHERE id='dd250bcc-7c68-4bc4-b048-e1799ab8431f';

UPDATE veiculos
SET em_troca_titularidade=false
WHERE id='d5181403-22c0-4f2a-b22e-b6e7d821376c';

UPDATE cotacoes
SET status='recusada'
WHERE id='440a2f3b-b336-474d-9dc4-26f81212238c';

UPDATE contratos
SET status='cancelado',
    cadastro_aprovado=false,
    aprovado_por=NULL,
    aprovado_em=NULL
WHERE id='71b21fd9-9aec-441c-bcbd-3d77fa0b0806';