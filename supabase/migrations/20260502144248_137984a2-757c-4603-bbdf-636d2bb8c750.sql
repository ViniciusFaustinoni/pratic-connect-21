
DO $$
DECLARE
  v_assoc uuid := 'c96a0b4f-909b-44a6-a396-fff4b1896c27';
  v_veic  uuid := 'a778b7ba-d774-4b9b-9da0-8e9c2fee1b6f';
  v_user_mvdm uuid;
  v_user_vini uuid;
  v_user_dativo uuid;
BEGIN
  SELECT user_id INTO v_user_mvdm   FROM public.profiles WHERE id='df49ae6c-d5d5-460b-ba32-3f6ab7ad36a4';
  SELECT user_id INTO v_user_vini   FROM public.profiles WHERE id='6f834291-b3c8-44e6-a96d-3c7a79fb50b5';
  SELECT user_id INTO v_user_dativo FROM public.profiles WHERE id='12455272-c87d-4512-98df-1e619bd7c0e5';

  -- Renomeia conta operacional preservada
  UPDATE public.profiles
     SET nome = 'Rastreador Operacional'
   WHERE id = '18e69620-9c04-417a-8831-90a87f88a783';

  -- Apaga o veículo (sem contratos vinculados; cotações usam só a placa)
  DELETE FROM public.veiculos WHERE id = v_veic;

  -- Apaga o associado (sem contratos vinculados conforme verificação)
  DELETE FROM public.associados WHERE id = v_assoc;

  -- Apaga profiles (e usuários auth correspondentes, se existirem)
  DELETE FROM public.profiles WHERE id IN (
    'df49ae6c-d5d5-460b-ba32-3f6ab7ad36a4',
    '6f834291-b3c8-44e6-a96d-3c7a79fb50b5',
    '12455272-c87d-4512-98df-1e619bd7c0e5'
  );

  IF v_user_mvdm   IS NOT NULL THEN DELETE FROM auth.users WHERE id = v_user_mvdm;   END IF;
  IF v_user_vini   IS NOT NULL THEN DELETE FROM auth.users WHERE id = v_user_vini;   END IF;
  IF v_user_dativo IS NOT NULL THEN DELETE FROM auth.users WHERE id = v_user_dativo; END IF;
END $$;
