UPDATE agendamentos_base
   SET status='cancelado',
       observacoes=COALESCE(observacoes||E'\n','')||'[saneamento] Troca de titularidade dentro da janela mesmo-dia — vistoria inicial dispensada. Agendamento criado por bug de roteamento do link público.',
       updated_at=now()
 WHERE cotacao_id='9db388ed-e3ee-443e-acc6-5afcbed33084'
   AND status NOT IN ('cancelado','concluido');

UPDATE cotacoes
   SET tipo_vistoria=NULL
 WHERE id='9db388ed-e3ee-443e-acc6-5afcbed33084';