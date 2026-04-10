

## Plano: Fluxo de fotos sequencial automático em todas as áreas

### Problema
Atualmente, em `ExecutarVistoriaCompleta.tsx`, `ExecutarRetirada.tsx` e `VistoriaPrestador.tsx`, as fotos são exibidas em grid (3 colunas) usando `FotoCapture`. O técnico precisa clicar manualmente em cada slot para tirar a próxima foto. O componente `VistoriaFotoSequencial` (já existente e usado em `InstaladorChecklist.tsx`) resolve isso com avanço automático.

### Solução
Substituir o grid de `FotoCapture` pelo `VistoriaFotoSequencial` nos 3 arquivos restantes. O componente já possui: barra de progresso, thumbnails, instruções, auto-avanço para a próxima foto pendente após upload.

### Alterações

#### 1. `src/pages/instalador/ExecutarVistoriaCompleta.tsx`
- Substituir o grid de `FotoCapture` dentro de cada categoria pelo `VistoriaFotoSequencial`
- Remover as categorias colapsáveis (Collapsible) de fotos, já que o sequencial mostra uma foto por vez com thumbnails
- Passar a lista completa de fotos (excluindo instalação se necessário) ao componente sequencial
- Adaptar `handleUploadFoto` para ser compatível com a interface `onUpload(fotoId, file)`

#### 2. `src/pages/instalador/ExecutarRetirada.tsx`
- Converter `FOTOS_RETIRADA` para o formato `VistoriaFotoConfig` (adicionar `icone`, `categoria`, `ordem`)
- Substituir o grid de `FotoCapture` pelo `VistoriaFotoSequencial`

#### 3. `src/pages/public/VistoriaPrestador.tsx`
- As fotos já usam `VistoriaFotoConfig` do `vistoriaConfigCompleta`
- Substituir o grid de `FotoCapture` pelo `VistoriaFotoSequencial`
- Adaptar `handleFotoCapture` para a interface `onUpload(fotoId, file)`

### Resultado
Todas as telas de captura de fotos passarão a usar o fluxo sequencial: o técnico tira uma foto e automaticamente avança para a próxima pendente, sem precisar navegar manualmente.

