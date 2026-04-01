

# Corrigir vídeo de autovistoria do associado na Aprovação

## Problema
Na tela de aprovação (`AprovacaoInstalacaoDetalhe.tsx`), o vídeo do associado (autovistoria) não aparece. O código busca o vídeo na tabela `vistorias` com `neq('modalidade', 'presencial')`, mas neste fluxo a autovistoria do associado é gravada no **fluxo da cotação** e salva na tabela `cotacoes_vistoria_fotos` (tipo `video_360`), e não como um registro separado em `vistorias`.

Dados confirmados no banco:
- Contrato `8d6d5baf` → cotação `11c71e04`
- `cotacoes_vistoria_fotos` tem o vídeo: `video_360-1775061231938.webm`
- Tabela `vistorias` tem apenas 1 registro (presencial/instalador) — sem autovistoria separada

## Correção

### Arquivo: `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx`

No bloco que busca `videoAssociado` (linhas 138-156), adicionar fallback para buscar em `cotacoes_vistoria_fotos` quando não encontrar na tabela `vistorias`:

1. Buscar `cotacao_id` do contrato via query em `contratos`
2. Se `videoAssociado` ainda for null e existir `cotacao_id`, buscar em `cotacoes_vistoria_fotos` onde `tipo = 'video_360'`

```ts
// Fallback: buscar vídeo da autovistoria em cotacoes_vistoria_fotos
if (!videoAssociado && servico.contrato_id) {
  const { data: contrato } = await supabase
    .from('contratos')
    .select('cotacao_id')
    .eq('id', servico.contrato_id)
    .maybeSingle();
  
  if (contrato?.cotacao_id) {
    const { data: fotoVideo } = await supabase
      .from('cotacoes_vistoria_fotos')
      .select('arquivo_url')
      .eq('cotacao_id', contrato.cotacao_id)
      .eq('tipo', 'video_360')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    videoAssociado = fotoVideo?.arquivo_url || null;
  }
}
```

## Impacto
- 1 arquivo, ~15 linhas adicionadas
- Resolve o caso onde a autovistoria foi feita no fluxo de cotação
- Mantém compatibilidade com o fluxo onde a autovistoria está em `vistorias`

