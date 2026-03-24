

# Adicionar Video 360 na Autovistoria da Cotacao

## Problema
O componente `AutovistoriaCotacao` (fluxo de cotacao publica) exige apenas 2 fotos (chassi e motor). O componente `Autovistoria` (fluxo de contrato/associado) ja exige video 360 + 2 fotos corretamente. O video 360 precisa ser adicionado ao fluxo de cotacao tambem.

## Referencia
O componente `src/components/associado/Autovistoria.tsx` ja implementa o fluxo completo: video 360 primeiro, depois fotos. Vou replicar essa logica no `AutovistoriaCotacao`.

## Alteracoes

### 1. `src/components/cotacao-publica/AutovistoriaCotacao.tsx`

Adicionar o video 360 como etapa obrigatoria antes das fotos:

- Importar `VideoCapture` de `@/components/instalador/VideoCapture`
- Adicionar estados: `videoUrl`, `uploadingVideo`
- Criar `handleVideoCapture` que faz upload via `useUploadFotoCotacaoVistoria` com `fotoId: 'video_360'`
- Criar `handleVideoReset` para permitir regravar
- Reidratar video existente (se `fotosExistentes` tiver tipo `video_360`)
- Mudar condicao `todasEnviadas` para incluir `!!videoUrl`
- Atualizar progresso para `fotos + video` (ex: "2/2 fotos • 1/1 video")
- Renderizar: se nao tem video ainda, mostrar tela de instrucoes + `VideoCapture` (igual ao `Autovistoria.tsx`). Apos video gravado, mostrar fluxo de fotos existente
- Usar `cameraOnly={true}` no `VideoCapture`

### 2. Fluxo resultante

```text
1. Tela de instrucoes do video 360 + componente VideoCapture (camera only)
2. Video gravado → mostrar fotos (chassi, motor) — fluxo existente
3. Todas fotos + video OK → botao "Concluir Vistoria"
```

Nenhuma alteracao em hooks ou config — o upload do video usa o mesmo `useUploadFotoCotacaoVistoria` com `fotoId: 'video_360'`, e o bucket `cotacoes-vistoria` ja aceita qualquer tipo de arquivo.

