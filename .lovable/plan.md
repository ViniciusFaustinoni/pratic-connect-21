

# Corrigir upload de vídeo 360° na autovistoria pública

## Problema
O vídeo é gravado com sucesso e o componente `VideoCapture` mostra o checkmark verde (preview local), mas o upload para o Supabase falha silenciosamente. O `videoUrl` no componente pai continua `null`, impedindo a transição para a Etapa 2.

**Causa raiz**: O hook `useUploadFotoCotacaoVistoria` usa o cliente `supabase` autenticado. Na página pública de cotação, o usuário não tem sessão, então o upload ao storage e o insert na tabela `cotacoes_vistoria_fotos` falham por RLS.

## Solução

### 1. `src/hooks/useCotacaoVistoria.ts` — Usar `publicSupabase` no upload
- Substituir `supabase` por `publicSupabase` nas operações de storage upload e upsert da tabela no `useUploadFotoCotacaoVistoria`
- Isso já é feito no `useFinalizarVistoriaCotacao` (linha 164), então é uma questão de consistência

### 2. `src/components/instalador/VideoCapture.tsx` — Feedback visual correto
- Não mostrar checkmark verde até o upload ser confirmado pelo pai
- Adicionar prop `confirmed?: boolean` para que o pai sinalize quando o upload foi concluído
- Enquanto `uploading` estiver true, mostrar spinner no lugar do check
- Se o upload falhar (previewUrl existe mas confirmed=false e uploading=false), mostrar estado de "tentar novamente"

### 3. `src/components/cotacao-publica/AutovistoriaCotacao.tsx` — Melhor tratamento de erro no vídeo
- Quando o upload falhar, resetar o vídeo local chamando `handleVideoReset` para que o usuário possa tentar novamente
- Ou manter o preview local e exibir botão de retry

## Detalhes técnicos

```text
Fluxo atual (quebrado):
VideoCapture.onstop → setPreviewUrl + onCapture(file)
                       ↓ (local ✓)     ↓ (async upload)
                     Mostra check     Upload falha (RLS)
                                      videoUrl = null
                                      → Preso na Etapa 1

Fluxo corrigido:
VideoCapture.onstop → setPreviewUrl + onCapture(file)
                       ↓ (local)       ↓ (async upload com publicSupabase)
                     Mostra spinner   Upload sucesso
                                      videoUrl = url
                                      → Avança para Etapa 2
```

## Arquivos editados
1. `src/hooks/useCotacaoVistoria.ts` — trocar `supabase` por `publicSupabase` no upload
2. `src/components/instalador/VideoCapture.tsx` — prop `confirmed` para feedback correto
3. `src/components/cotacao-publica/AutovistoriaCotacao.tsx` — passar `confirmed` e melhor tratamento de erro

