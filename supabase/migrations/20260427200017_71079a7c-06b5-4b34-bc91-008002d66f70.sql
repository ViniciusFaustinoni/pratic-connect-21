UPDATE public.error_reports
SET status = 'em_tratamento',
    tratado_em = COALESCE(tratado_em, now()),
    tratado_por = COALESCE(tratado_por, '4218616b-44c1-473b-a8cc-d2eb5a8d10dc'),
    observacao_diretor = 'Investigado. Não localizamos no código nenhum bloqueio de "8 horas" na atribuição de serviços ao técnico — a capacidade é controlada por número de tarefas (capacidade_diaria, default 5) e janela de horário comercial (8h-20h, que é apenas para envio de mensagens). Para corrigir o erro real precisamos: (1) print da mensagem exata exibida ao tentar atribuir; (2) ID do técnico e do serviço afetado. Sem isso, mexer no limite errado pode quebrar a fila de produção. Permanece em tratamento aguardando print/IDs.'
WHERE id = '95dd8ffd-9ff8-480a-bbec-b63fba39431b';

UPDATE public.error_reports
SET status = 'em_tratamento',
    tratado_em = COALESCE(tratado_em, now()),
    tratado_por = COALESCE(tratado_por, '4218616b-44c1-473b-a8cc-d2eb5a8d10dc'),
    observacao_diretor = 'Investigado. Para identificar a causa raiz do veículo "reaparecer" mesmo com rastreador vinculado precisamos: (1) placa OU CPF do associado; (2) print da tela onde ele aparece indevidamente; (3) confirmação se o serviço aparece em "Atribuição Manual", "Mapa", "Aba Equipe" ou outra. Existem múltiplas filas (agendamentos_base, servicos, instalacoes) e cada uma tem regras próprias de fechamento — sem o caso real corremos risco de fechar serviço legítimo em produção. Permanece em tratamento aguardando dados.'
WHERE id = '25d19898-b734-435c-be9b-65f1ebdc4134';