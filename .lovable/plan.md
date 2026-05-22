## Contexto

Na tela do técnico (`InstaladorChecklist`), o componente `VideoCapture` é montado com `cameraOnly` fixo (linha 1421 de `src/pages/instalador/InstaladorChecklist.tsx`). Isso esconde o botão "Selecionar da Galeria", obrigando o uso da câmera ao vivo — comportamento correto para o técnico em campo (antifraude).

Quando o Coordenador de Monitoramento abre essa mesma tela via `VistoriaInternaDialog` (caso PYL9A01: serviço `nao_compareceu`, veículo `instalacao_pendente`, sem `video_360_url`), ele tipicamente já recebeu o vídeo por outro canal (WhatsApp, etc.) e precisa **anexar** o arquivo — não regravar.

## O que muda

Adicionar uma flag `vistoriaInterna` que percorre `VistoriaInternaDialog → InstaladorChecklist → VideoCapture` e libera o upload do vídeo da galeria **somente** nesse contexto.

### Arquivos

**1. `src/pages/instalador/InstaladorChecklist.tsx`**
- Adicionar `vistoriaInterna?: boolean` em `InstaladorChecklistProps`.
- Na montagem do `<VideoCapture>` (linha 1413), trocar `cameraOnly` fixo por `cameraOnly={!vistoriaInterna}`.

**2. `src/components/monitoramento/VistoriaInternaDialog.tsx`**
- Repassar `vistoriaInterna` como prop ao `<InstaladorChecklist>` (linha 53).

### Não muda

- Fluxo do técnico (`/instalador/checklist/:id`) continua `cameraOnly` — câmera ao vivo obrigatória.
- Todas as outras etapas (Dados, Checklist, Fotos, Decisão), validações, hooks, mutations, triggers DB permanecem idênticos.
- Comportamento das fotos (que já permite seleção de arquivo dentro do próprio fluxo) não é alterado.
- `handleVideoCapture` e o pipeline de upload (`videoUpload.ts`, bucket, progress) já aceitam `File` de qualquer origem — nenhum ajuste necessário.

## Resultado esperado no caso PYL9A01

Ao abrir Vistoria Interna pelo Monitoramento, na etapa Fotos o card de "Vídeo 360°" passa a mostrar o botão "Selecionar da Galeria" abaixo de "Gravar Vídeo", permitindo anexar o vídeo recebido externamente sem precisar regravar.
