

# Autovistoria: Exigir 31 fotos + vídeo (igual ao instalador)

## Problema
A autovistoria do cliente exige apenas **15 fotos** (carro) e **sem vídeo**. Para veículos com FIPE < R$ 30.000 (isentos de rastreador), essa é a única inspeção — insuficiente.

## Solução
Substituir as 15 fotos de `autovistoriaConfig.ts` pelas mesmas 31 do instalador (`vistoriaConfigCompleta.ts`), excluindo apenas `local_rastreador`. Adicionar vídeo 360° obrigatório nos dois componentes de autovistoria.

## Arquivos a alterar

### 1. `src/data/autovistoriaConfig.ts`
- Substituir `FOTOS_AUTOVISTORIA_CARRO` (15 fotos) por 31 fotos espelhando `FOTOS_VISTORIA_COMPLETA` (sem `local_rastreador`), com instruções e dicas adaptadas para o cliente
- Categorias: Identificação/Motor (6), Exterior 360° (9), Pneus (4), Interior/Acessórios (5), Bancos/Forrações (7)
- Manter `FOTOS_AUTOVISTORIA_MOTO` (7 fotos) como está

### 2. `src/components/cotacao-publica/AutovistoriaCotacao.tsx`
- Importar e adicionar `VideoCapture` após todas as fotos
- Upload do vídeo via `useUploadFotoCotacaoVistoria` com tipo `video_360`
- Condição de finalização: todas 31 fotos **+ vídeo** enviados
- Adicionar estado `videoUrl` e lógica de upload de vídeo

### 3. `src/components/associado/Autovistoria.tsx`
- Mesmo: importar `VideoCapture`, adicionar após fotos
- Upload via `useUploadFotoAutovistoria` com tipo `video_360`
- Tela de conclusão só aparece quando fotos + vídeo completos

## IDs das 31 fotos (espelhando instalador)
```text
Identificação/Motor: selfie_veiculo, chave, chassi, capo_aberto_placa, motor, bateria
Exterior 360°: frente, parabrisa, frente_lateral_direita, lateral_direita, traseira_lateral_direita, traseira, traseira_lateral_esquerda, lateral_esquerda, frente_lateral_esquerda
Pneus: pneu_dianteiro_direito, pneu_traseiro_direito, pneu_traseiro_esquerdo, pneu_dianteiro_esquerdo
Interior: mala_aberta, estepe, chave_roda_macaco, odometro, painel_completo
Bancos: banco_motorista, banco_passageiro, banco_traseiro, forracao_porta_dianteira_esquerda, forracao_porta_traseira_esquerda, forracao_porta_traseira_direita, forracao_porta_dianteira_direita
```

