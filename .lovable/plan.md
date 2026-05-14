
## Objetivo

Reverter o conjunto de mai/2026 (9 fotos) e voltar à autovistoria enxuta:
- **2 fotos obrigatórias** (carro e moto): `frente_centro` + `chassi`
- **1 vídeo 360°** mostrando o veículo em volta + **painel ligado** (motor funcionando, hodômetro visível)

Aplicar tanto na Cotação (fluxo público novo — `EtapaVistoria` → `AutovistoriaCotacao`) quanto na Autovistoria do associado existente (`Autovistoria.tsx`), que hoje compartilham `getFotosAutovistoria`.

## Mudanças

### 1) `src/data/autovistoriaConfig.ts`
- Substituir `fotosCarro` e `fotosMoto` por **apenas 2 itens** cada:
  1. `frente_centro` — "Frente — placa centralizada" (validaPlaca: true)
  2. `chassi` — "Número do Chassi" (validaPlaca: false; carro = base do para-brisa, moto = tubo do garfo)
- Reduzir `FOTOS_VALIDAR_PLACA` para `['frente_centro']` (única foto com OCR de placa).
- Reativar `getInstrucoesVideo360` e `getLabelVideo360` (remover stubs `@deprecated`):
  - Passos: 1) Frente, 2) Lateral esquerda, 3) Traseira, 4) Lateral direita, 5) Voltar à frente, 6) **Pan para o painel com a moto/carro LIGADO mostrando hodômetro**.
  - Label: "Vídeo 360° + painel ligado".
- Atualizar comentário do topo do arquivo registrando o novo conjunto.

### 2) `src/components/cotacao-publica/AutovistoriaCotacao.tsx`
- Importar `VideoCapture`, `getInstrucoesVideo360`, `getLabelVideo360`, `useUploadFotoCotacaoVistoria` (já usado).
- Estado novo: `videoUrl`, `uploadingVideo`, `videoProgress`.
- Reidratar `video_360` a partir de `fotosExistentes` (filtro hoje é o oposto: `tipo !== 'video_360'` — adicionar bloco que detecta e popula `videoUrl`).
- Adicionar bloco "Vídeo 360°" abaixo das 2 fotos:
  - Lista os passos retornados por `getInstrucoesVideo360(tipoVeiculo)` (último passo destacando "painel ligado").
  - `<VideoCapture>` chamando `uploadMutation.mutateAsync({ cotacaoId, fotoId: 'video_360', file, ... })` (helper já trata `isVideo`).
- `handleFinalizar`: bloquear se `!todasFotosEnviadas || !videoUrl`. Mostrar toast claro ("Grave o vídeo 360° com o painel ligado").
- Atualizar contador no header: `{fotosCompletadas + (videoUrl?1:0)}/{totalFotos+1} itens` ou similar (visual claro de "2 fotos + vídeo").
- O OCR do hodômetro era acoplado a `painel_ligado` (foto). Como a leitura agora vem do vídeo, **remover** o branch `isFotoOdometro` e o input manual de KM nesse componente — o KM passa a ser informado/aprovado pela equipe na revisão (ou por OCR futuro do frame final do vídeo, fora deste escopo).

### 3) `src/components/associado/Autovistoria.tsx`
- Mesma lógica do passo 2: 2 fotos + vídeo 360° + painel ligado obrigatório. Usar `vistoria_videos`/coluna `video_360_url` já existente para associados (manter o caminho atual de upload de vídeo se houver; senão replicar o `VideoCapture` com `useUploadFotoCotacaoVistoria` quando aplicável). Verificar e seguir o mesmo padrão da cotação.

### 4) Sem mudanças em `concluir-etapa-fotos-publica` / banco
- A coluna `vistorias.video_360_url` já existe (vide `AcompanhamentoProposta` e edge function).
- `cotacoes_vistoria_fotos` já aceita `tipo='video_360'` (`useUploadFotoCotacaoVistoria` trata).
- Não criar migration.

## Fora de escopo
- Vistoria completa 31/15 (sub-FIPE) — segue como está (`vistoriaConfigCompleta`).
- Vistoria do técnico em campo (instalador) — não altera.
- OCR automático de hodômetro a partir do vídeo — pode ser feito em fase futura.

## Verificação
1. Reabrir a cotação `COT-20260514-164930343-286` (TDC0F74) → step Vistoria deve mostrar **2 fotos + bloco de vídeo 360°**.
2. Tentar finalizar sem vídeo → bloqueado com toast.
3. Enviar vídeo + 2 fotos → finalizar com sucesso e seguir para Pagamento.
4. Refresh no meio do fluxo → fotos e vídeo reidratam.
