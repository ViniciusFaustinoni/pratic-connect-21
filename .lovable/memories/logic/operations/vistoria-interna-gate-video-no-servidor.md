---
name: Gate de vídeo da vistoria interna exige URL no servidor
description: ExecutarVistoriaCompleta.tsx — gate videoEnviado nunca aceita preview local; só libera Aprovar quando vistorias.video_360_url está populado, evitando vistoria concluída sem vídeo
type: feature
---
Cenário: técnico interno (ExecutarVistoriaCompleta) grava vídeo 360°; o blob cai no IndexedDB (useUploadVistoriaOffline.enfileirarVideo) e useSyncQueue sobe em background. Antes da correção, o gate `videoEnviado = !!video360Url` aceitava `previewVideo` (blob local) — o técnico aprovava com vídeo pendente; se a sync falhasse (5 tentativas), o app fechasse ou desse OOM antes do upload concluir, a vistoria virava `concluida` com `vistorias.video_360_url=NULL` (caso GILBERTO SILVA MOREIRA / OOV8C87 — 31 fotos OK, vídeo perdido).

Regra canônica: `videoEnviado = modoApenasInstalacao || !!video360UrlServidor`. O preview local segue mostrando o clipe gravado, mas o botão Aprovar só destrava quando a fila terminar de subir e gravar a URL na linha da vistoria. Mensagem dedicada quando há upload pendente (`videoPendenteUpload`): "⏳ Aguardando upload do vídeo 360° concluir antes de aprovar."

Não mexer em fotos (gate continua aceitando preview porque são pequenas, múltiplas e cada uma sobe rápido — risco isolado por slot). Vale só para o vídeo, único grande e crítico.
