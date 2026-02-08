
# Redesign Completo: Página de Rastreadores

## Visão Geral

Transformar a página `/monitoramento/rastreadores` de uma tabela densa e pouco intuitiva para uma interface moderna, fluida e focada na experiência do operador, inspirada no padrão visual já utilizado na página de "Equipe de Campo".

---

## Problemas Atuais Identificados

1. **Tabela densa**: Muitas colunas (11 colunas) dificultam a leitura em telas menores
2. **Cards de métricas genéricos**: Sem hierarquia visual ou destaque adequado
3. **Filtros em linha única**: Podem ficar apertados em mobile
4. **Sem visualização de cards**: Apenas tabela, sem opção de grid
5. **Ações escondidas**: Menu dropdown requer cliques extras
6. **Falta de feedback visual**: Status de comunicação pouco destacado
7. **Sem indicadores visuais de urgência**: Alertas não têm destaque visual

---

## Proposta de Redesign

### 1. Novo Layout de Métricas

Substituir os 4 cards atuais por uma barra de métricas mais compacta e visualmente rica:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  📡 Total    │  ✅ Online    │  ⚠️ Atenção    │  🔴 Offline    │  📦 Estoque │
│    12        │     5         │      2         │       3        │      4      │
│ cadastrados  │  comunicando  │  1-24h sem     │  +24h sem      │  disponíveis│
└─────────────────────────────────────────────────────────────────────────────┘
```

**Implementação**: Novo componente `RastreadorMetrics.tsx` seguindo o padrão de `EquipeMetrics.tsx`

### 2. Filtros Aprimorados

Novo layout de filtros com:
- Busca com largura maior
- Filtros em chips clicáveis (toggle)
- Indicador visual de filtros ativos
- Botão de limpar todos os filtros

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔍 [                  Buscar por IMEI, código, placa...                   ] │
├─────────────────────────────────────────────────────────────────────────────┤
│ Status: [●Todos] [Estoque] [Instalado] [Manutenção]  Plataforma: [▼ Todas] │
│ Comunicação: [●Todos] [Online] [Atenção] [Offline]        [Limpar filtros] │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3. Alternância Tabela / Cards

Adicionar toggle para escolher visualização:

```text
┌───────────────────────────────────────────────────────────────────┐
│ Lista de Rastreadores (12)            [📋 Tabela] [▦ Cards] [+] │
└───────────────────────────────────────────────────────────────────┘
```

### 4. Novo Componente: RastreadorCard

Cards visuais inspirados no `EquipeCard.tsx`:

```text
┌──────────────────────────────────────────────────────────────────┐
│ ● [barra colorida status comunicação]                            │
├──────────────────────────────────────────────────────────────────┤
│  🔋                                                        [⋮]  │
│  62667083403686              [Em Estoque] [● Online]            │
│  IMEI: 62667083403686                                            │
│  Plataforma: Softruck                                            │
│  ─────────────────────────────────────────────────────────────── │
│  🚗 LTB4J74 - Fiat Strada                                        │
│  👤 Marcus Vinicius Faustinoni de Freitas                        │
│  📧 dativoph@gmail.com                                           │
│  ─────────────────────────────────────────────────────────────── │
│  📡 Última comunicação: há 2 horas                               │
│  📍 Velocidade: 0 km/h | Ignição: Desligada                      │
│  ─────────────────────────────────────────────────────────────── │
│  [👁️ Detalhes]  [🔧 Manutenção]  [📍 Localizar]                  │
└──────────────────────────────────────────────────────────────────┘
```

**Características**:
- Barra superior colorida indicando status de comunicação (verde/amarelo/vermelho)
- Badge de status do rastreador
- Informações organizadas em seções
- Ações rápidas visíveis (não escondidas em dropdown)
- Hover com elevação suave

### 5. Tabela Simplificada

Reduzir colunas da tabela de 11 para 7:

| Antes | Depois |
|-------|--------|
| Checkbox, Código, Nº Série, IMEI, Plataforma, Status, Portador, Comunicação, Veículo, Email Associado, Ações | Checkbox, IMEI/Código, Plataforma, Status, Veículo/Associado, Comunicação, Ações |

**Melhorias**:
- Combinar Código/IMEI em uma coluna com tooltip
- Combinar Veículo/Associado em uma coluna compacta
- Remover Nº Série e Email (disponíveis no drawer de detalhes)
- Ícones de status de comunicação mais proeminentes

### 6. Indicadores Visuais de Urgência

Para rastreadores offline há muito tempo:
- Badge pulsante vermelho
- Linha com fundo levemente vermelho na tabela
- Contador de horas/dias sem comunicação

### 7. Barra de Seleção em Lote (Floating Bar)

Aprimorar a barra atual:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ✓ 3 selecionados    [👤 Atribuir Portador] [🔧 Manutenção em Lote] [✕ Limpar]│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Estrutura de Arquivos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/rastreadores/RastreadorMetrics.tsx` | Criar | Novo painel de métricas |
| `src/components/rastreadores/RastreadorCard.tsx` | Criar | Card individual de rastreador |
| `src/components/rastreadores/RastreadorFiltersV2.tsx` | Criar | Novos filtros com chips toggle |
| `src/components/rastreadores/RastreadorGridView.tsx` | Criar | Grid de cards |
| `src/components/rastreadores/RastreadorTableView.tsx` | Criar | Tabela simplificada extraída |
| `src/components/rastreadores/RastreadorListHeader.tsx` | Criar | Header com toggle de visualização |
| `src/pages/monitoramento/Rastreadores.tsx` | Reescrever | Página principal redesenhada |
| `src/components/rastreadores/index.ts` | Atualizar | Exportar novos componentes |

---

## Detalhes Técnicos

### RastreadorMetrics.tsx

```tsx
// Métricas exibidas:
const metrics = [
  { label: 'Total', value: metricas.total, icon: Radio, color: 'primary' },
  { label: 'Online', value: metricas.online, icon: Wifi, color: 'emerald' },
  { label: 'Atenção', value: metricas.alertas - metricas.offline, icon: AlertTriangle, color: 'amber' },
  { label: 'Offline', value: metricas.offline, icon: WifiOff, color: 'red' },
  { label: 'Estoque', value: metricas.estoque, icon: Package, color: 'blue' },
];
```

### RastreadorCard.tsx

```tsx
// Estrutura principal
<Card className="group overflow-hidden hover:shadow-lg transition-all">
  {/* Barra de status de comunicação */}
  <div className={cn(
    "h-1",
    isOnline && "bg-gradient-to-r from-emerald-500 to-emerald-400",
    isAtencao && "bg-gradient-to-r from-amber-500 to-amber-400",
    isOffline && "bg-gradient-to-r from-red-500 to-red-400",
  )} />
  
  <CardContent className="p-4">
    {/* Header com código e badges */}
    {/* Informações do veículo/associado */}
    {/* Dados de comunicação */}
    {/* Ações rápidas */}
  </CardContent>
</Card>
```

### Estado de Visualização

```tsx
// Em Rastreadores.tsx
const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
// Persistir preferência no localStorage
```

### Animações

Utilizar `framer-motion` (já instalado) para:
- Transição suave entre visualizações (tabela ↔ cards)
- Entrada animada dos cards
- Feedback visual ao selecionar/deselecionar

---

## Fluxo de Interação Aprimorado

1. **Usuário entra na página**: Vê métricas no topo, filtros abaixo, e grid de cards
2. **Clica em card**: Drawer de detalhes abre lateralmente
3. **Ações rápidas visíveis**: Botões de ação no próprio card
4. **Filtros rápidos**: Chips de toggle para filtrar por status
5. **Busca inteligente**: Busca por IMEI, código, placa ou nome do associado
6. **Seleção em lote**: Checkboxes nos cards para operações em massa

---

## Resultado Visual Esperado

Uma página que:
- ✅ Exibe informações hierarquicamente (métricas → filtros → lista)
- ✅ Permite alternar entre visão de cards e tabela
- ✅ Destaca visualmente rastreadores que precisam de atenção
- ✅ Oferece ações rápidas sem escondê-las em dropdowns
- ✅ Funciona bem em desktop e mobile
- ✅ Usa o mesmo padrão visual da página de Equipe
- ✅ Proporciona feedback visual imediato (animações, cores, ícones)
