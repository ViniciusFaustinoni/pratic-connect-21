-- Mudar Softruck para ambiente de produção (sandbox está instável)
UPDATE rastreadores_config_plataformas 
SET ambiente_atual = 'producao'
WHERE plataforma = 'softruck';