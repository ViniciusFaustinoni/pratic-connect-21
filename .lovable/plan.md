

## Plano: Reduzir autovistoria de carro de 31 para 15 fotos

### Arquivo alterado
`src/data/autovistoriaConfig.ts`

### Fotos que permanecem (reordenadas 1-15)

| # | ID existente | Label |
|---|---|---|
| 1 | `selfie_veiculo` | Selfie com o Veículo ao Fundo |
| 2 | `chassi` | Número do Chassi |
| 3 | `frente` | Frente do Veículo |
| 4 | `lateral_direita` | Lateral Direita Completa |
| 5 | `traseira` | Traseira Completa |
| 6 | `lateral_esquerda` | Lateral Esquerda Completa |
| 7 | `capo_aberto_placa` | Capô Aberto com Placa |
| 8 | `pneu_dianteiro_direito` | Sola do Pneu Dianteiro Direito |
| 9 | `pneu_traseiro_direito` | Sola do Pneu Traseiro Direito |
| 10 | `pneu_traseiro_esquerdo` | Sola do Pneu Traseiro Esquerdo |
| 11 | `pneu_dianteiro_esquerdo` | Sola do Pneu Dianteiro Esquerdo |
| 12 | `banco_motorista` | Banco Dianteiro do Motorista |
| 13 | `banco_traseiro` | Banco Traseiro |
| 14 | `banco_passageiro` | Banco Dianteiro do Passageiro |
| 15 | `odometro` | Odômetro (Veículo Ligado) |

### Fotos removidas (16 itens - responsabilidade do instalador)

`chave`, `motor`, `bateria`, `parabrisa`, `frente_lateral_direita`, `traseira_lateral_direita`, `traseira_lateral_esquerda`, `frente_lateral_esquerda`, `mala_aberta`, `estepe`, `chave_roda_macaco`, `painel_completo`, `forracao_porta_dianteira_esquerda`, `forracao_porta_traseira_esquerda`, `forracao_porta_traseira_direita`, `forracao_porta_dianteira_direita`

### Detalhes técnicos

- Reescrever o array `FOTOS_AUTOVISTORIA_CARRO` com apenas os 15 itens acima, renumerando `ordem` de 1 a 15
- Atualizar comentário de "31 fotos" para "15 fotos"
- Reorganizar categorias: `identificacao` (1-2), `exterior` (3-7), `pneus` (8-11), `interior` (12-15)
- Mover `dicaExtra` de última foto para o `odometro` (foto 15): "Esta é a última foto! Após enviar, grave o vídeo 360° para concluir."
- Nenhuma alteração em `FOTOS_AUTOVISTORIA_MOTO`, `vistoriaConfigCompleta.ts`, ou componentes consumidores (usam `getFotosAutovistoria().length` dinamicamente)

