
# Exibir dados da vistoria do regulador na pagina de analise

## Problema

A pagina de analise do sinistro (`SinistroAnalise.tsx`) nao busca nem exibe os dados da vistoria realizada pelo regulador (tabela `vistorias_evento`). O card "Documentos" mostra apenas documentos do associado. Quando o regulador conclui a vistoria (fotos, orcamento, parecer), o analista nao consegue ver essas informacoes.

## Alteracoes

### 1. `src/hooks/useSinistroAnalise.ts`

Adicionar uma nova query para buscar a vistoria de evento concluida do sinistro:

```typescript
const { data: vistoriaEvento } = useQuery({
  queryKey: ['sinistro-analise-vistoria-evento', sinistroId],
  queryFn: async () => {
    const { data } = await supabase
      .from('vistorias_evento')
      .select('*')
      .eq('sinistro_id', sinistroId!)
      .order('concluida_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  },
  enabled: !!sinistroId,
});
```

Retornar `vistoriaEvento` no objeto de retorno do hook.

### 2. `src/pages/eventos/SinistroAnalise.tsx`

**a) Receber `vistoriaEvento` do hook:**
```typescript
const { sinistro, documentos, ..., vistoriaEvento } = useSinistroAnalise(id);
```

**b) Renomear card "Documentos" para "Anexos do Regulador":**
- Alterar titulo de `Documentos ({count})` para `Anexos do Regulador ({count})`
- Manter toda a logica de exibicao de documentos/fotos/audios/videos existente

**c) Adicionar ao final do card "Anexos do Regulador" os dados de texto da vistoria:**
Apos a lista de documentos, renderizar os dados do `vistoriaEvento.dados_vistoria` em sub-secoes:

- **Diagnostico**: tipo de dano (parcial/total), descricao tecnica
- **Etapas de Reparo**: lista de etapas selecionadas (badges)
- **Itens do Orcamento**: tabela com descricao, tipo, quantidade de cada item (sem valores, conforme regra de negocio - valores sao preenchidos pelo analista)
- **Parecer do Regulador**: parecer tecnico (texto) e recomendacao (aprovar/analise detalhada)
- **Observacoes Perda Total**: se tipo_dano === 'total', exibir justificativa

Cada sub-secao tera um `Separator` e titulo em negrito. Os dados serao exibidos somente se `vistoriaEvento?.dados_vistoria` existir.

**d) Adicionar fotos e video do regulador ao card:**
Se `dados_vistoria.fotos_urls` existir, exibir galeria de thumbnails clicaveis (reaproveitando o mesmo padrao de imagens ja usado no card de auto-vistoria).
Se `dados_vistoria.video_url` existir, exibir botao para assistir.

### Dados disponiveis em `dados_vistoria` (JSON):

| Campo | Tipo | Descricao |
|-------|------|-----------|
| tipo_dano | string | "parcial" ou "total" |
| descricao_tecnica | string | Descricao tecnica dos danos |
| etapas_reparo | array | [{id, nome, selecionada, status}] |
| itens_orcamento | array | [{descricao, tipo, quantidade, tipo_peca, veiculo_marca, ...}] |
| valor_total_orcamento | number | Total de servicos/mao de obra |
| parecer_tecnico | string | Texto do parecer |
| recomendacao | string | "aprovar" ou "analise_detalhada" |
| observacoes_perda_total | string | Justificativa se perda total |
| fotos_urls | string[] | URLs das fotos do regulador |
| video_url | string | URL do video do regulador |

### Resultado esperado

O analista de eventos vera no card "Anexos do Regulador":
1. Todas as fotos e video capturados pelo regulador (galeria)
2. Documentos do associado (existente)
3. Diagnostico com tipo de dano e descricao tecnica
4. Etapas de reparo selecionadas
5. Lista de itens do orcamento (pecas e servicos)
6. Parecer tecnico e recomendacao do regulador
