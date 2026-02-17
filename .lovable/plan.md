
# Historico Visual de Atualizacoes Diarias no Card do Veiculo

## O que sera feito

Adicionar uma secao colapsavel em cada card de veiculo na tela do regulador (`ReguladorOficina.tsx`) que exibe as ultimas atualizacoes diarias registradas, com fotos em miniatura, descricao e data.

## Alteracoes

### Arquivo: `src/pages/regulador/ReguladorOficina.tsx`

1. **Nova query para buscar atualizacoes de todos os veiculos listados**: Usar os IDs das ordens de servico visíveis para buscar as ultimas atualizacoes da tabela `os_atualizacoes_diarias`, ordenadas por `created_at desc`, limitadas a 3 por OS.

2. **Novo componente interno `HistoricoAtualizacoes`**: Recebe o array de atualizacoes de uma OS e renderiza:
   - Data formatada (ex: "15/02 as 14:30")
   - Descricao resumida (truncada se longa)
   - Miniaturas das fotos (ate 4, clicaveis)
   - Badge de etapa concluida se houver
   - Indicador de problema se `tem_problema === true`

3. **Integrar no card do veiculo**: Adicionar um `Collapsible` (ja disponível via Radix) entre as etapas de progresso e os botoes de acao, com trigger "Ver historico (X atualizacoes)". Ao expandir, mostra as ultimas 3 atualizacoes.

### Detalhes tecnicos

**Query de atualizacoes (agrupada por OS):**
```typescript
const osIds = veiculos.map(v => v.id);
const { data: atualizacoesRecentes } = useQuery({
  queryKey: ['atualizacoes-recentes', osIds.join(',')],
  queryFn: async () => {
    if (osIds.length === 0) return [];
    const { data } = await supabase
      .from('os_atualizacoes_diarias')
      .select('id, ordem_servico_id, created_at, descricao, etapa_concluida, tem_problema, tipo_problema, fotos_urls')
      .in('ordem_servico_id', osIds)
      .order('created_at', { ascending: false })
      .limit(100);
    return data || [];
  },
  enabled: osIds.length > 0,
});

// Agrupar por OS
const atualizacoesPorOS = useMemo(() => {
  const map: Record<string, any[]> = {};
  (atualizacoesRecentes || []).forEach(a => {
    if (!map[a.ordem_servico_id]) map[a.ordem_servico_id] = [];
    if (map[a.ordem_servico_id].length < 3) map[a.ordem_servico_id].push(a);
  });
  return map;
}, [atualizacoesRecentes]);
```

**Componente HistoricoAtualizacoes:**
```tsx
function HistoricoAtualizacoes({ atualizacoes }: { atualizacoes: any[] }) {
  return (
    <div className="space-y-2 border-t pt-2 mt-1">
      {atualizacoes.map((a) => (
        <div key={a.id} className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{format(new Date(a.created_at), "dd/MM 'as' HH:mm", { locale: ptBR })}</span>
            {a.etapa_concluida && <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">✓ {a.etapa_concluida}</Badge>}
            {a.tem_problema && <Badge className="bg-red-100 text-red-700 text-[9px]">⚠ Problema</Badge>}
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-2">{a.descricao}</p>
          {a.fotos_urls?.length > 0 && (
            <div className="flex gap-1">
              {(a.fotos_urls as string[]).slice(0, 4).map((url, i) => (
                <img key={i} src={url} className="w-10 h-10 rounded object-cover" />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

**Integracao no card (apos EtapasProgress, antes dos botoes):**
```tsx
{atualizacoesPorOS[v.id]?.length > 0 && (
  <Collapsible>
    <CollapsibleTrigger asChild>
      <Button variant="ghost" size="sm" className="w-full h-7 text-[11px] text-muted-foreground">
        Ver historico ({atualizacoesPorOS[v.id].length} atualizacoes)
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <HistoricoAtualizacoes atualizacoes={atualizacoesPorOS[v.id]} />
    </CollapsibleContent>
  </Collapsible>
)}
```

### Imports adicionais
- `Collapsible, CollapsibleTrigger, CollapsibleContent` de `@/components/ui/collapsible`

### Resultado visual

Cada card de veiculo tera, abaixo das etapas de progresso, um botao discreto "Ver historico (3 atualizacoes)". Ao clicar, expande mostrando as ultimas 3 atualizacoes com data, descricao, miniaturas de fotos, badges de etapa concluida e alertas de problemas.
