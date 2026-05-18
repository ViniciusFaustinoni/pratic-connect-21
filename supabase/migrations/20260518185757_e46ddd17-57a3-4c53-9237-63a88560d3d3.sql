
UPDATE servicos
SET status='cancelada', updated_at=now(),
    observacoes = coalesce(observacoes,'') || E'\n[2026-05-18] Cancelado: ativação já concluída em 24/04, serviço materializado artificialmente pelo reprocesso de hoje (KXV3F40 / LENIZIA).'
WHERE id='e5aa546d-9f62-4586-a622-d85679da2f1b';

UPDATE vistorias
SET status='cancelada', updated_at=now(),
    observacoes = coalesce(observacoes,'') || E'\n[2026-05-18] Cancelada: ativação concluída em 24/04 sem necessidade desta vistoria (sub-FIPE, KXV3F40).'
WHERE id='4726f120-d6a3-4942-a753-58df1b738fbd';
