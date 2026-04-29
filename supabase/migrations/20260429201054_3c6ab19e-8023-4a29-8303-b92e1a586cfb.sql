
-- 1) Corrigir registros remanescentes (instalação e serviço do veículo do ERICO
--    ainda apontando para o associado_id do TOVAR).
UPDATE instalacoes
   SET associado_id = '6ab7a0b2-17ba-4406-b30b-4096d74dd971',
       updated_at   = now()
 WHERE id = '20a8dd46-3357-46ba-a46a-e85025aa0b32'
   AND veiculo_id = '6aae322e-b207-432b-bdae-2c2a8c8916a4';

UPDATE servicos
   SET associado_id = '6ab7a0b2-17ba-4406-b30b-4096d74dd971',
       updated_at   = now()
 WHERE id = '5d433548-4289-4573-a33d-b4098eb3fc39'
   AND veiculo_id = '6aae322e-b207-432b-bdae-2c2a8c8916a4';

-- 2) Varredura preventiva: corrige QUALQUER outra linha em instalacoes/servicos
--    onde associado_id divergir do dono atual do veículo.
UPDATE instalacoes i
   SET associado_id = v.associado_id, updated_at = now()
  FROM veiculos v
 WHERE i.veiculo_id = v.id
   AND v.associado_id IS NOT NULL
   AND i.associado_id IS DISTINCT FROM v.associado_id;

UPDATE servicos s
   SET associado_id = v.associado_id, updated_at = now()
  FROM veiculos v
 WHERE s.veiculo_id = v.id
   AND v.associado_id IS NOT NULL
   AND s.associado_id IS DISTINCT FROM v.associado_id;

-- 3) Trigger anti-divergência
CREATE OR REPLACE FUNCTION public.tg_enforce_associado_matches_veiculo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF NEW.veiculo_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT associado_id INTO v_owner FROM veiculos WHERE id = NEW.veiculo_id;

  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.associado_id IS NULL THEN
    NEW.associado_id := v_owner;
    RETURN NEW;
  END IF;

  IF NEW.associado_id <> v_owner THEN
    RAISE WARNING '[enforce_associado_matches_veiculo] Divergencia em %: associado_id=% mas veiculo % pertence a %. Corrigindo automaticamente.',
      TG_TABLE_NAME, NEW.associado_id, NEW.veiculo_id, v_owner;
    NEW.associado_id := v_owner;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_associado_instalacoes ON instalacoes;
CREATE TRIGGER trg_enforce_associado_instalacoes
  BEFORE INSERT OR UPDATE OF veiculo_id, associado_id ON instalacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_associado_matches_veiculo();

DROP TRIGGER IF EXISTS trg_enforce_associado_servicos ON servicos;
CREATE TRIGGER trg_enforce_associado_servicos
  BEFORE INSERT OR UPDATE OF veiculo_id, associado_id ON servicos
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_associado_matches_veiculo();

DROP TRIGGER IF EXISTS trg_enforce_associado_rastreadores ON rastreadores;
CREATE TRIGGER trg_enforce_associado_rastreadores
  BEFORE INSERT OR UPDATE OF veiculo_id, associado_id ON rastreadores
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_associado_matches_veiculo();
