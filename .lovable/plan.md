## Diagnóstico

Vistoria do associado **LMF8I79**, aba Veículos → Galeria de Autovistoria (`src/pages/cadastro/AssociadoDetalhe.tsx` linhas 959-999):

- O modal atual (linhas 1239-1250) é um `<Dialog>` simples que mostra **apenas** `fotoModal.url` — não recebe a lista de fotos, não tem index, não tem setas de navegação.
- Cada thumbnail clicada chama `setFotoModal({ open:true, url: foto.arquivo_url, ... })` substituindo só a URL exibida.
- Resultado:
  - **Sintoma "abre sempre a mesma"**: provavelmente o navegador está reaproveitando o `<img>` cacheado, ou o usuário acha que não trocou porque as fotos do CRLV (chassi/motor) são parecidas. Sem indicador "1/3" e sem setas o usuário não consegue confirmar nem navegar.
  - **Sintoma "preciso clicar na primeira e passar nas setas"**: as setas que ele menciona são as nativas do navegador entre abas — ele não tem navegação dentro do modal.

## Solução

### 1. Novo componente `src/components/cadastro/MediaViewerModal.tsx`

Visualizador genérico com:
- **Lista de itens** (`items: MediaItem[]`) + `initialIndex`.
- **Setas laterais** (esq/dir) sobre a imagem + **navegação por teclado** (←, →, Esc).
- **Contador "X / N"** no header.
- **Tira de miniaturas** clicáveis no rodapé (destaca a atual).
- **Botão de download/abrir em nova aba**.
- Suporta `image | video | pdf`.
- Usa `key={current.url}` no `<img>/<video>/<iframe>` para forçar re-render ao trocar (mata o cache visual).

### 2. Refatorar `AssociadoDetalhe.tsx`

- Substituir o estado simples `fotoModal` por `mediaViewer: { open, items, index }`.
- Na **Galeria de Autovistoria** (linha 976): ao clicar numa thumbnail, montar a lista plana de **todas** as fotos da galeria (todas as categorias agrupadas, na ordem em que aparecem) e abrir o viewer no index correto da foto clicada.
- Mesma lógica para a galeria do **instalador** (linha 938) e para a tabela de **documentos** (linhas 886/896): cada uma abre o viewer com sua própria lista navegável.
- Remover o `<Dialog>` antigo (linhas 1239-1250) — fica só o `<MediaViewerModal />`.

## Arquivos alterados

- `src/components/cadastro/MediaViewerModal.tsx` (novo, ~140 linhas).
- `src/pages/cadastro/AssociadoDetalhe.tsx` (substituir estado + 3 pontos de chamada + remover modal antigo).

## Resultado esperado

- Clicar em qualquer foto abre o lightbox **naquela foto específica**.
- Setas (UI e teclado) percorrem todas as fotos da galeria atual em sequência.
- Contador e tira de miniaturas dão feedback visual de qual foto está aberta.
- Funciona igual para imagens, vídeos (incluindo o vídeo 360° quando presente) e PDFs.

Sem mudanças de banco, sem mudanças nos hooks. Apenas UI.
