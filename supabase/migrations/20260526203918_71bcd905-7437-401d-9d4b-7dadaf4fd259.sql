-- Saneamento RTZ5C34: gravar nome canônico FIAT/ARGO 1.0 em todas as camadas.
-- Modelo curto "argo" estava saindo no termo de filiação sem cilindrada.
UPDATE public.veiculos
   SET modelo = 'ARGO 1.0'
 WHERE placa = 'RTZ5C34' AND lower(modelo) = 'argo';

UPDATE public.contratos
   SET veiculo_modelo = 'ARGO 1.0'
 WHERE veiculo_placa = 'RTZ5C34' AND lower(veiculo_modelo) = 'argo';

UPDATE public.cotacoes
   SET veiculo_modelo = 'ARGO 1.0'
 WHERE veiculo_placa = 'RTZ5C34' AND lower(veiculo_modelo) = 'argo';

UPDATE public.leads
   SET veiculo_modelo = 'ARGO 1.0'
 WHERE veiculo_placa = 'RTZ5C34' AND lower(veiculo_modelo) = 'argo';