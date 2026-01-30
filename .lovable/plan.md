

# Plano: Visualização de Cotações Finalizadas por Data e Consultor

## Resumo

Adicionar filtros avançados na aba "Finalizadas" da página de Cotações para permitir que gestores, comerciais, admins e diretores visualizem cotações finalizadas organizadas por data específica e por consultor.

## Situação Atual

A página `src/pages/vendas/Cotacoes.tsx` já possui:
- Tabs separando "Em Andamento" e "Finalizadas"
- Filtro por **mês** (período mensal)
- Filtro por **status**
- Campo de **busca** por texto

## O Que Será Implementado

| Funcionalidade | Descrição |
|---------------|-----------|
| Filtro por Data | Seletor de data específica para ver cotações de um dia |
| Filtro por Consultor | Dropdown com lista de vendedores para filtrar por responsável |
| Combinação de Filtros | Ambos os filtros funcionando simultaneamente |
| Visibilidade Condicional | Filtro de consultor aparece apenas para gestores (quem pode ver todas) |

## Regras de Negócio

### Visibilidade por Perfil

| Perfil | Vê filtro de Consultor? | Vê quais cotações? |
|--------|-------------------------|---------------------|
| Vendedor CLT/Externo | Não | Apenas as próprias |
| Supervisor de Vendas | Sim | Da equipe |
| Gerente Comercial | Sim | Todas |
| Diretor | Sim | Todas |
| Admin Master | Sim | Todas |

### Comportamento dos Filtros

1. **Filtro de Data**:
   - Calendário para selecionar data específica
   - Opção "Todos os dias" para ver tudo
   - Filtra pela data de criação (`created_at`) da cotação

2. **Filtro de Consultor**:
   - Dropdown com vendedores
   - Opção "Todos" para ver de todos
   - Visível apenas para quem tem `viewScope === 'all'` ou `viewScope === 'team'`

3. **Combinação**:
   - Data + Consultor funcionam juntos
   - Ex: "30/01/2026 + João Silva" mostra só as cotações do João naquele dia

## Fluxo Visual

```text
┌─────────────────────────────────────────────────────────────────┐
│  Cotação                                        + Nova Cotação  │
├─────────────────────────────────────────────────────────────────┤
│  [Total: 50] [Enviadas: 10] [Aceitas: 35] [Taxa: 70%]          │
├─────────────────────────────────────────────────────────────────┤
│  [Buscar...]  [Status ▼]  [Consultor ▼]  [📅 Data ▼]           │
├─────────────────────────────────────────────────────────────────┤
│  [Em Andamento (15)]  [✓ Finalizadas (35)]                     │
├─────────────────────────────────────────────────────────────────┤
│  📅 30/01/2026 - 5 cotações                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ✓ ACEITA  João Silva        Toyota Corolla   R$ 211,00/mês ││
│  │ ✓ ACEITA  João Silva        Honda Civic      R$ 195,00/mês ││
│  │ ✗ RECUSADA Maria Costa      VW Golf          R$ 180,00/mês ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  📅 29/01/2026 - 3 cotações                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ✓ ACEITA  Pedro Lima        Fiat Argo        R$ 150,00/mês ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Alterações Técnicas

### 1. Modificar `src/pages/vendas/Cotacoes.tsx`

**Novos estados**:
```typescript
const [dataFilter, setDataFilter] = useState<Date | undefined>(undefined);
const [consultorFilter, setConsultorFilter] = useState<string>('all');
```

**Importar hook de vendedores**:
```typescript
import { useVendedores } from '@/hooks/useVendedores';
```

**Nova lógica de filtragem**:
```typescript
// Filtrar por data específica
let matchesData = true;
if (dataFilter) {
  const cotacaoDate = new Date(cotacao.created_at);
  const filterDate = dataFilter;
  matchesData = 
    cotacaoDate.getDate() === filterDate.getDate() &&
    cotacaoDate.getMonth() === filterDate.getMonth() &&
    cotacaoDate.getFullYear() === filterDate.getFullYear();
}

// Filtrar por consultor
let matchesConsultor = true;
if (consultorFilter !== 'all') {
  matchesConsultor = cotacao.vendedor_id === consultorFilter;
}
```

**Novo componente de filtro de data**:
```typescript
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" className="w-full sm:w-auto">
      <Calendar className="h-4 w-4 mr-2" />
      {dataFilter ? format(dataFilter, 'dd/MM/yyyy') : 'Todos os dias'}
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    <Calendar 
      mode="single"
      selected={dataFilter}
      onSelect={setDataFilter}
    />
  </PopoverContent>
</Popover>
```

**Filtro de consultor (condicional)**:
```typescript
{permissions.cotacao.viewScope !== 'own' && (
  <Select value={consultorFilter} onValueChange={setConsultorFilter}>
    <SelectTrigger className="w-full sm:w-48">
      <User className="h-4 w-4 mr-2" />
      <SelectValue placeholder="Todos os consultores" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todos os consultores</SelectItem>
      {vendedores?.map(v => (
        <SelectItem key={v.user_id} value={v.user_id}>{v.nome}</SelectItem>
      ))}
    </SelectContent>
  </Select>
)}
```

### 2. Agrupamento por Data na Visualização

Para cotações finalizadas, agrupar visualmente por data:

```typescript
// Agrupar finalizadas por data
const finalizadasPorData = useMemo(() => {
  const grupos: Record<string, CotacaoWithRelations[]> = {};
  
  fechadas.forEach(cotacao => {
    const data = format(new Date(cotacao.created_at), 'yyyy-MM-dd');
    if (!grupos[data]) grupos[data] = [];
    grupos[data].push(cotacao);
  });
  
  return Object.entries(grupos)
    .sort(([a], [b]) => b.localeCompare(a)) // Mais recente primeiro
    .map(([data, cotacoes]) => ({
      data,
      dataFormatada: format(new Date(data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
      cotacoes,
    }));
}, [fechadas]);
```

### 3. Renderização Agrupada

```tsx
<TabsContent value="fechadas">
  {finalizadasPorData.map(grupo => (
    <div key={grupo.data} className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span className="font-medium">{grupo.dataFormatada}</span>
        <Badge variant="secondary">{grupo.cotacoes.length}</Badge>
      </div>
      {grupo.cotacoes.map(cotacao => (
        <CotacaoCard key={cotacao.id} ... />
      ))}
    </div>
  ))}
</TabsContent>
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/vendas/Cotacoes.tsx` | Adicionar filtros de data e consultor, agrupar por data |

## Benefícios

1. **Acompanhamento diário** - Gestores podem ver performance de cada dia
2. **Análise por consultor** - Filtrar para ver desempenho individual
3. **Combinação de filtros** - Visão granular (data + consultor)
4. **Interface intuitiva** - Agrupamento visual por data facilita navegação
5. **Controle de acesso** - Vendedores não veem filtro de consultor (só suas próprias cotações)

