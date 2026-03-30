

# Adicionar Vídeos 360° na Análise de Instalação (Aprovação Monitoramento)

## Problema

A página de análise de instalação (`AprovacaoInstalacaoDetalhe.tsx`) não exibe os vídeos 360° gravados pelo instalador e pelo associado. Esses vídeos existem no banco, mas o hook de busca não os carrega.

**Causa**: O `video_360_url` é armazenado na tabela `vistorias` (não em `instalacao_fotos` ou `vistoria_fotos`). A página atual só busca fotos dessas tabelas e filtra por `tipo === 'video_360'`, que raramente tem registros.

## Como funciona na página de ativação (referência)

A página `VistoriaCompletaAnalise.tsx` já faz isso corretamente:
- **Vídeo do instalador**: busca `vistorias.video_360_url` via `vistoria_origem_id` do serviço
- **Vídeo do associado**: busca uma segunda vistoria vinculada ao `contrato_id` com `modalidade != 'presencial'`, que contém o `video_360_url` da autovistoria

## Solução

### `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx`

No hook `useServicoDetalheAprovacao`:

1. **Buscar vistoria do instalador** — Após ter o serviço, buscar na tabela `vistorias` via `servico.vistoria_origem_id` (ou fallback por `instalacao_origem_id` → `vistorias.instalacao_id`), obtendo o campo `video_360_url`

2. **Buscar autovistoria do associado** — Buscar em `vistorias` onde `contrato_id = servico.contrato_id` e `modalidade != 'presencial'`, obtendo o `video_360_url` da autovistoria

3. **Retornar ambos os URLs** no objeto de retorno: `videoInstalador` e `videoAssociado`

Na renderização:

4. **Substituir a seção "Vídeo 360°"** atual (que depende de `videoFotos` filtradas por tipo) por uma seção com dois players separados e identificados:
   - "Vídeo 360° — Instalador" (se existir)
   - "Vídeo 360° — Associado" (se existir)
   - Cada um com badge indicando a autoria

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx` | Buscar `video_360_url` de ambas as vistorias + renderizar players separados |

