
ALTER TABLE substituicoes_veiculo
  DROP CONSTRAINT substituicoes_veiculo_veiculo_antigo_id_fkey,
  ADD CONSTRAINT substituicoes_veiculo_veiculo_antigo_id_fkey
    FOREIGN KEY (veiculo_antigo_id) REFERENCES veiculos(id) ON DELETE CASCADE;

ALTER TABLE substituicoes_veiculo
  DROP CONSTRAINT substituicoes_veiculo_veiculo_novo_id_fkey,
  ADD CONSTRAINT substituicoes_veiculo_veiculo_novo_id_fkey
    FOREIGN KEY (veiculo_novo_id) REFERENCES veiculos(id) ON DELETE CASCADE;
