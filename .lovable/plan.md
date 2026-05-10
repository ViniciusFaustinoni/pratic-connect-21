## Correções no Modal de Troca de Titularidade — `VeiculoCompletoCard.tsx`

### 1. Fotos da vistoria não aparecem (thumbnails quebrados)
O hook `useFotosVistoriaPorVeiculo` retorna `arquivo_url` e `tipo`, mas o card lê `f.url` e `f.tipo_foto` (que não existem) → `<img src={undefined}>` mostra "foto" quebrado.

**Fix:** trocar `f.url` → `f.arquivo_url` e `f.tipo_foto` → `f.tipo` na grid e no `mediaItems` passado ao `MediaViewerModal`.

### 2. GET da posição do rastreador ao abrir o modal
Hoje o card só mostra `rastreador.ultima_comunicacao` do banco (estática, vazia no print). Já existe a edge function `rastreador-posicao` e o hook `useRastreadorTempoReal` (usado no MapaRastreador).

**Fix:** no bloco "Rastreador" do `VeiculoCompletoCard`, chamar `useRastreadorTempoReal(rastreador.id, false)` (sem auto-refresh, dispara 1 GET ao montar). Usar `posicao?.data_posicao` como "Última comunicação" quando disponível, com fallback para `rastreador.ultima_comunicacao`. Mostrar um pequeno spinner enquanto `isLoading`.

### 3. Erro de comunicação com o rastreador
Se a edge function falhar (`error` truthy ou `data.success=false`), mostrar inline no bloco do rastreador um aviso vermelho discreto: ícone `AlertTriangle` + texto "Erro de comunicação com o rastreador" e a mensagem do erro em texto pequeno. Manter os demais campos visíveis.

### Escopo
- Apenas `src/components/troca-titularidade/VeiculoCompletoCard.tsx`.
- Sem mudanças em hooks, edge functions, schema ou no fluxo de aprovação.
- Sem polling — apenas 1 GET por abertura do modal (re-monta dispara nova chamada).
