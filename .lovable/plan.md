

## Plano: Paginar query de `planos_coberturas` no motor de cotação

### Problema encontrado

A query de `planos_coberturas` no motor de cotação (`usePlanosCotacao.ts`, linha 182) **não tem paginação**. Existem **2385 registros** na tabela, mas o Supabase retorna no máximo **1000 por padrão**. Resultado: **1385 coberturas são descartadas silenciosamente**.

Isso afeta **todas as linhas** (não apenas SP e Lagos), pois a ordenação por UUID distribui as perdas aleatoriamente. Cada plano tem 9 coberturas, mas na prática apenas 1-7 são retornadas, causando:
- Preços **incorretamente menores** (coberturas faltam na soma)
- Coberturas **não listadas** nos cards de cotação

### Dados da auditoria completa

| Dimensão | SELECT orig | SELECT - SP | SELECT - Lagos | LANÇAMENTO orig | LANÇAMENTO - SP | LANÇAMENTO - Lagos |
|----------|-------------|-------------|----------------|-----------------|-----------------|---------------------|
| Planos | 37 | 37 | 37 | 37 | 37 | 37 |
| Coberturas | 333 | 333 | 333 | 333 | 333 | 333 |
| Benefícios | 213 | 213 | 213 | 213 | 213 | 213 |
| Carência cob. | 0 | 0 | 0 | 0 | 0 | 0 |
| Carência ben. (Vidros) | 29 | 29 | 29 | 29 | 29 | 29 |
| Regras combustivel | 333 | 333 | 333 | 333 | 333 | 333 |
| Regras fipe_range | 333 | 333 | 333 | 333 | 333 | 333 |
| Regras fipe_eligibility | 73 | 73 | 73 | 73 | 73 | 73 |
| Regras tipo_placa | 216 | 216 | 216 | 216 | 216 | 216 |
| Regras tipo_uso | 332 | 332 | 332 | 332 | 332 | 332 |
| Regras regiao | 333 | 333 | 333 | 333 | 333 | 333 |

**Estrutura, regras de elegibilidade, carências e benefícios estão 100% pareados.** O único problema é a query de coberturas no motor de cotação.

### Correção

**Arquivo:** `src/hooks/usePlanosCotacao.ts` (linhas 178-189)

Adicionar paginação na query de `planos_coberturas`, similar ao que já existe em `useAllEligibilityRules`:

```typescript
const { data: planoCoberturasData, isLoading: planoCoberturasLoading } = useQuery({
  queryKey: ['planos_coberturas_pricing'],
  queryFn: async () => {
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('planos_coberturas')
        .select('plano_id, cobertura_id, coberturas:cobertura_id (nome, valor)')
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      allData = allData.concat(data || []);
      if (!data || data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return allData;
  },
  staleTime: 1000 * 60 * 5,
});
```

### Resultado esperado
- Todas as 2385 coberturas serão carregadas (3 páginas de 1000)
- Preços corretos para todas as linhas, incluindo SP e Lagos
- Cards de cotação mostrarão todas as coberturas de cada plano

