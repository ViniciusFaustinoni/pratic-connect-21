DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='hinova_mapeamentos_tipo_codigo_local_uk'
  ) THEN
    CREATE UNIQUE INDEX hinova_mapeamentos_tipo_codigo_local_uk
      ON public.hinova_mapeamentos (tipo, codigo_local);
  END IF;
END$$;

INSERT INTO public.hinova_mapeamentos (tipo, codigo_local, codigo_hinova, descricao, ativo)
VALUES
  ('categoria_veiculo', 'taxi',           0, 'Táxi (flag_taxi_ativo) — preencher codigo_hinova e ativar', false),
  ('categoria_veiculo', 'leilao',         0, 'Leilão (flag_leilao) — preencher codigo_hinova e ativar', false),
  ('categoria_veiculo', 'placa_vermelha', 0, 'Placa Vermelha / Aluguel (flag_placa_vermelha) — preencher codigo_hinova e ativar', false),
  ('categoria_veiculo', 'ex_taxi',        0, 'Ex-Táxi (flag_ex_taxi) — preencher codigo_hinova e ativar', false)
ON CONFLICT (tipo, codigo_local) DO NOTHING;