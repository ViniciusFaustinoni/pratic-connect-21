
# Plano: Dashboard Centralizado para Diretor

## Contexto

Atualmente, quando um Diretor acessa `/dashboard`, ele vê o mesmo dashboard genérico de vendas com:
- KPIs básicos (Associados, Leads, Instalações, Receita)
- Ações Rápidas (Nova Cotação, Novo Lead)
- Funil de Cotação
- Instalações Hoje (oculto para diretores)

Já existe um dashboard executivo completo em `/diretoria` com métricas estratégicas, mas o Diretor precisa navegar manualmente até lá.

---

## Solução Proposta

Quando o usuário for identificado como **Diretor**, o Dashboard principal exibirá:

### Layout Centralizado

```text
┌─────────────────────────────────────────────────────────────┐
│                 Banner de Boas-Vindas                       │
├─────────────────────────────────────────────────────────────┤
│  [7 KPIs em linha - Métricas Executivas]                    │
│  Associados | Receita | Sinistralidade | Conversão |        │
│  Inadimplência | Resultado | Rateio                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────┐  ┌─────────────────────────┐ │
│  │   Gráfico de Evolução     │  │   Saúde Financeira      │ │
│  │   (Receita x Sinistros)   │  │   + Alertas Críticos    │ │
│  │                           │  │   + Ações Rápidas       │ │
│  └───────────────────────────┘  └─────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────┐  ┌─────────────────────────┐ │
│  │  Indicadores Operacionais │  │  Distribuição por Plano │ │
│  │  (Grid 2x3)               │  │  (Gráfico de Pizza)     │ │
│  └───────────────────────────┘  └─────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Métricas Exibidas para o Diretor

| Categoria | Métricas |
|-----------|----------|
| **KPIs Financeiros** | Associados Ativos, Receita do Período, Sinistralidade, Resultado Operacional |
| **KPIs Comerciais** | Taxa de Conversão, Taxa de Inadimplência, Valor do Rateio/Cota |
| **Gráficos** | Evolução Mensal (12 meses), Distribuição por Plano |
| **Operacionais** | Leads, Conversões, Instalações, Assistências, Tempo Médio Trânsito/Execução |
| **Saúde Financeira** | Barra de Sinistralidade, Margem Operacional, Fundo de Reserva |
| **Alertas** | Sinistralidade Alta, Inadimplência Alta, Fundo de Reserva Baixo |

---

## Alterações no Código

### Arquivo: `src/pages/Dashboard.tsx`

#### 1. Adicionar Verificação de Perfil Diretor

No início do componente, após as verificações existentes:

```typescript
// Se é diretor, mostrar dashboard executivo
if (isDiretor) {
  return <DiretoriaDashboard />;
}
```

#### 2. Importar o Componente

Adicionar import do DiretoriaDashboard:

```typescript
import DiretoriaDashboard from '@/pages/diretoria/DiretoriaDashboard';
```

---

## Fluxo de Renderização por Perfil

| Perfil | Dashboard Renderizado |
|--------|----------------------|
| Analista de Cadastro | DashboardCadastro |
| Coordenador de Monitoramento | DashboardCoordenador |
| Instalador/Vistoriador | Redireciona para /instalador |
| **Diretor** | **DiretoriaDashboard** (novo) |
| Vendedor | Dashboard padrão (Funil + Leads) |
| Outros | Dashboard padrão |

---

## Resultado Esperado

- **Diretores** verão automaticamente o dashboard executivo com todas as métricas estratégicas ao acessar `/dashboard`
- O layout já está centralizado no DiretoriaDashboard existente
- Todas as métricas relevantes (sinistralidade, receita, rateio, alertas) estarão visíveis
- Gráficos de evolução e distribuição por plano serão exibidos
- Alertas críticos (sinistralidade alta, inadimplência, fundo baixo) serão destacados

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Dashboard.tsx` | Adicionar import e condição para renderizar DiretoriaDashboard quando isDiretor |

---

## Seção Técnica

### Código Completo da Alteração

```typescript
// No topo do arquivo, adicionar import:
import DiretoriaDashboard from '@/pages/diretoria/DiretoriaDashboard';

// Dentro do componente Dashboard, após as verificações existentes:
// (após if isAnalistaCadastroOnly e if isCoordenadorMonitoramentoOnly)

// Se é diretor, mostrar dashboard executivo
if (isDiretor) {
  return <DiretoriaDashboard />;
}
```

### Posição no Código

A verificação será inserida após a linha 315 (depois da verificação de coordenador de monitoramento):

```typescript
// Se é coordenador de monitoramento, mostrar dashboard específico
if (isCoordenadorMonitoramentoOnly) {
  return <DashboardCoordenador />;
}

// NOVA VERIFICAÇÃO - Se é diretor, mostrar dashboard executivo
if (isDiretor) {
  return <DiretoriaDashboard />;
}
```

### Observação

A variável `isDiretor` já está sendo importada do hook `usePermissions()` na linha 292, então não é necessário adicionar nenhuma desestruturação adicional.
