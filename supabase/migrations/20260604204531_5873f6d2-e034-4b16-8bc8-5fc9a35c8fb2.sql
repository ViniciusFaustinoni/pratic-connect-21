-- Reset estado de atendimento APENAS do contato 5521982244909 (CPF 14194896742, Marcos)
DO $$
DECLARE
  tel TEXT := '5521982244909';
  v_msg INT; v_con INT; v_fila INT; v_lock INT; v_pausa INT; v_leit INT;
BEGIN
  DELETE FROM whatsapp_mensagens WHERE telefone = tel;
  GET DIAGNOSTICS v_msg = ROW_COUNT;
  DELETE FROM whatsapp_fila_ia WHERE telefone = tel;
  GET DIAGNOSTICS v_fila = ROW_COUNT;
  DELETE FROM agente_ia_locks WHERE telefone = tel;
  GET DIAGNOSTICS v_lock = ROW_COUNT;
  DELETE FROM whatsapp_ia_pausas WHERE telefone = tel;
  GET DIAGNOSTICS v_pausa = ROW_COUNT;
  DELETE FROM whatsapp_conversa_leituras WHERE telefone = tel;
  GET DIAGNOSTICS v_leit = ROW_COUNT;
  DELETE FROM agente_ia_contatos WHERE telefone = tel;
  GET DIAGNOSTICS v_con = ROW_COUNT;
  RAISE NOTICE 'Reset tel=% msg=% contatos=% fila=% locks=% pausas=% leituras=%', tel, v_msg, v_con, v_fila, v_lock, v_pausa, v_leit;
END $$;