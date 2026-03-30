

# Corrigir Vídeo 360° do Associado na Aprovação de Instalação

## Problema
Na página de aprovação do associado (`AprovacaoInstalacaoDetalhe.tsx`), apenas o vídeo do instalador aparece. O vídeo 360° da autovistoria do associado não é exibido.

## Causa raiz
A query na linha 141-147 tem dois problemas:

1. **Filtra apenas vistorias que já têm `video_360_url` preenchido** (`.not('video_360_url', 'is', null)`), eliminando autivistorias onde o vídeo pode estar armazenado de outra forma ou ainda não vinculado
2. **Não exclui a vistoria do instalador** — se o instalador também tem `modalidade != 'presencial'` e `video_360_url`, `maybeSingle()` pode retornar a vistoria errada ou falhar com múltiplos resultados

A página de ativação (`useVistoriaCompletaAnalise.ts`) funciona corretamente porque:
- Não filtra por `video_360_url IS NOT NULL`
- Usa `.limit(1)` com `.order('created_at', { ascending: false })`
- Busca fotos separadamente da vistoria encontrada

## Correção

### `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx` (linhas 138-149)

Alinhar a query de autovistoria com o padrão que funciona na ativação:
- Remover `.not('video_360_url', 'is', null)` — buscar a vistoria independente de ter vídeo
- Adicionar `.limit(1)` antes de `.maybeSingle()`
- Adicionar `.order('created_at', { ascending: false })` para pegar a mais recente
- Se `servico.vistoria_origem_id` existir, adicionar `.neq('id', servico.vistoria_origem_id)` para excluir a vistoria do instalador

| Arquivo | Ação |
|---|---|
| `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx` | Corrigir query de autovistoria do associado |

