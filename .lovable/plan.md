

## Redesign da Página de Cotações

### Problemas Identificados na Interface Atual

Analisando a imagem e o código existente, identifico os seguintes pontos a melhorar:

1. **Cards de estatísticas muito grandes e espalhados** - ocupam muito espaço vertical
2. **Área de filtros com muitos campos** - visual poluído e confuso
3. **Tabela com informações densas** - difícil leitura rápida
4. **Falta de hierarquia visual clara** - todos elementos parecem ter a mesma importância
5. **Espaçamento inconsistente** - gaps grandes entre seções

### Solução Proposta

#### 1. Cards de Estatísticas Compactos e Modernos

Transformar os 4 cards em uma barra horizontal mais compacta e moderna:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📄 1                     ✈ 0               ✓ 1               📈 100%  │
│  Total Cotações           Enviadas          Aceitas           Conversão │
└─────────────────────────────────────────────────────────────────────────┘
```

**Mudanças:**
- Cards menores, mais compactos
- Ícones ao lado dos números, não em círculos separados
- Gradiente sutil no fundo
- Bordas arredondadas suaves
- Valores com cores mais vibrantes

#### 2. Barra de Filtros Simplificada

Consolidar filtros em uma única linha limpa:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ 🔍 Buscar...           │ Status ▾  │ Período ▾  │ 📅 Data │ 👤 Consultor│
└───────────────────────────────────────────────────────────────────────────┘
```

**Mudanças:**
- Remover labels acima dos campos (usar placeholders)
- Filtros em linha única, mais compactos
- Select triggers menores e com ícones embutidos
- Remover bordas desnecessárias

#### 3. Tabela Redesenhada

Melhorar legibilidade e interatividade:

**Mudanças na Tabela:**
- Células com padding mais generoso
- Status badges mais compactos com cores mais suaves
- Avatar circular menor e mais elegante
- Hover row com transição suave
- Alternância de cor nas linhas para melhor legibilidade

#### 4. Melhorias Visuais Gerais

| Elemento | Antes | Depois |
|----------|-------|--------|
| Cards | 4 cards grandes verticais | Barra horizontal compacta |
| Filtros | Campos com labels acima | Linha única com placeholders |
| Tabela | Densa, uniforme | Espaçada, com zebra e hover |
| Badges | Tamanhos inconsistentes | Uniformes e compactos |
| Cores | Muito saturadas | Mais suaves, gradientes sutis |

### Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/pages/vendas/Cotacoes.tsx` | Cards compactos, filtros inline, espaçamentos |
| `src/components/cotacoes/CotacoesTable.tsx` | Estilização tabela, hover states, badges |

### Detalhes Técnicos

**Cotacoes.tsx - Cards Estatísticos:**
```tsx
// De 4 cards separados para 1 card com 4 métricas inline
<Card className="bg-gradient-to-r from-card to-muted/30">
  <CardContent className="p-4">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 divide-x divide-border/50">
      {/* Cada métrica inline com ícone + valor + label */}
    </div>
  </CardContent>
</Card>
```

**Filtros Compactos:**
```tsx
<div className="flex flex-wrap items-center gap-2">
  {/* Input com ícone embutido, sem label */}
  {/* Selects compactos sem labels */}
</div>
```

**CotacoesTable.tsx - Estilos da Tabela:**
```tsx
// Adicionar zebra striping
<TableRow className="even:bg-muted/30 hover:bg-muted/50 transition-colors">

// Badges mais compactos
<Badge className="text-[10px] px-2 py-0.5">
```

### Resultado Visual Esperado

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Cotações                                            [+ Nova Cotação]          │
│ Gerencie todas as cotações e acompanhe propostas                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │  📄 1 Total    │   ✈ 0 Enviadas   │   ✓ 1 Aceitas   │   📈 100% Taxa   │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ 🔍 Lead, veículo...  │ Todos status ▾ │ Período ▾ │ Data ▾ │ Consultor ▾   │
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Status      │ Cliente              │ Veículo        │ FIPE    │ Data    │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ ✓ ACEITA    │ M Marcus Vinicius... │ 🚗 Toyota      │ R$ 70k  │ 05/02   │ │
│ │ Assoc.Ativo │                      │ 2013 • ABC1234 │         │ 2h atrás│ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                    Clique em uma linha para ver detalhes                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Impacto

- Interface mais limpa e moderna
- Melhor aproveitamento do espaço vertical
- Filtros mais intuitivos e menos poluídos
- Tabela com melhor legibilidade
- Experiência visual mais agradável e profissional
- Mantém todas as funcionalidades existentes

