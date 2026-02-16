

# Exibir Fotos da Vistoria de Instalacao do Rastreador na Tela de Analise

## O que sera feito

Adicionar uma nova secao na tela de analise do sinistro que exibe as fotos tiradas durante a instalacao do rastreador no veiculo. Isso permite ao analista comparar o estado do veiculo no momento da instalacao com o estado atual (pos-sinistro).

## Fluxo de dados

```text
sinistro.veiculo_id
       |
       v
instalacoes (veiculo_id, status='concluida')
       |
       v
instalacao_fotos (instalacao_id)
       |
       v
Exibir fotos na tela de analise com lightbox
```

## Alteracoes

### Arquivo 1: `src/hooks/useSinistroAnalise.ts`

**Adicionar query para buscar fotos da instalacao do rastreador:**

- Nova query `instalacaoFotos` que:
  1. Busca a instalacao concluida mais recente do veiculo (`instalacoes` com `veiculo_id` e `status = 'concluida'`)
  2. Busca todas as fotos dessa instalacao na tabela `instalacao_fotos`
- Retornar `instalacaoFotos` no objeto de retorno do hook

### Arquivo 2: `src/pages/eventos/SinistroAnalise.tsx`

**Adicionar secao "Fotos da Vistoria de Instalacao":**

- Posicionar logo abaixo da secao "Fotos da Auto-Vistoria" (apos o card do linkEvento, por volta da linha 700)
- Novo card com:
  - Titulo: "Fotos da Vistoria de Instalacao" com icone Camera
  - Subtitulo: "Fotos registradas durante a instalacao do rastreador"
  - Grid de fotos (3 colunas) com label de cada tipo (Frente, Traseira, Placa, Local Rastreador, etc.)
  - Clique na foto abre o `VisualizadorFoto` (lightbox) ja existente no projeto
- Usar os labels de `FOTOS_INSTALACAO` do hook `useInstalacaoFotos.ts` para mapear tipo -> nome legivel
- Se nao houver fotos de instalacao, nao exibir a secao (condicional)

## Detalhes tecnicos

### Nova query no hook

```typescript
const { data: instalacaoFotos = [] } = useQuery({
  queryKey: ['sinistro-analise-instalacao-fotos', sinistro?.veiculo_id],
  queryFn: async () => {
    // Buscar instalacao concluida mais recente do veiculo
    const { data: instalacao } = await supabase
      .from('instalacoes')
      .select('id')
      .eq('veiculo_id', sinistro!.veiculo_id)
      .eq('status', 'concluida')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!instalacao) return [];

    // Buscar fotos dessa instalacao
    const { data: fotos } = await supabase
      .from('instalacao_fotos')
      .select('*')
      .eq('instalacao_id', instalacao.id)
      .order('created_at', { ascending: true });

    return fotos || [];
  },
  enabled: !!sinistro?.veiculo_id,
});
```

### Exibicao no componente

- Usar mapeamento de tipos existente em `FOTOS_INSTALACAO` para labels
- Integrar com `VisualizadorFoto` (estado separado `fotoViewerInstalacao`)
- Grid responsivo com thumbnails e labels sobrepostos (mesmo padrao visual das fotos de auto-vistoria)

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useSinistroAnalise.ts` | Adicionar query para buscar instalacao concluida + fotos da instalacao_fotos |
| `src/pages/eventos/SinistroAnalise.tsx` | Adicionar card com grid de fotos da instalacao e lightbox integrado |

