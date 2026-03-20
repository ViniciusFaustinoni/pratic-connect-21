

# Reordenar fotos da autovistoria (15 fotos — carro)

## Problema

A ordem atual coloca o Chassi como 2a foto (logo após a selfie), quebrando o fluxo natural de quem está andando ao redor do veículo. O associado precisa se abaixar para encontrar o chassi no para-brisa antes mesmo de fotografar o exterior.

## Nova ordem proposta (fluxo físico lógico)

```text
EXTERIOR — Caminhada ao redor do veículo:
 1. Selfie com veículo (já está na frente)
 2. Frente do veículo (continua na frente)
 3. Lateral Direita (caminha para a direita)
 4. Traseira (continua caminhando)
 5. Lateral Esquerda (completa a volta)
 6. Capô Aberto com Placa (volta à frente, abre o capô)
 7. Chassi (aproveita que está na frente, olha base do para-brisa)

PNEUS — Segunda volta rápida:
 8. Pneu Dianteiro Direito
 9. Pneu Traseiro Direito
10. Pneu Traseiro Esquerdo
11. Pneu Dianteiro Esquerdo

INTERIOR — Entra no veículo:
12. Banco do Motorista (abre porta, fotografa)
13. Banco do Passageiro (cruza para o outro lado)
14. Banco Traseiro (abre porta traseira)
15. Odômetro (liga o veículo, última foto)
```

## Alteração

**Arquivo**: `src/data/autovistoriaConfig.ts`

Reordenar os itens do array `FOTOS_AUTOVISTORIA_CARRO` e atualizar o campo `ordem` de cada um para refletir a nova sequência. Chassi move da posição 2 para 7. Frente sobe de 3 para 2. Capô sobe de 7 para 6. Banco passageiro e traseiro trocam de posição para seguir o fluxo físico (motorista → passageiro → traseiro).

Nenhum outro arquivo precisa ser alterado — o componente `Autovistoria.tsx` já itera pelo array na ordem em que é retornado.

