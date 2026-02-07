
# Plano: Ajustar Visibilidade de Cards e Layout do Dashboard

## Alterações Solicitadas

1. **Card "Últimos Leads"** - Ocultar para todos os usuários, EXCETO vendedores (que veem apenas os seus leads)
2. **Card "Ações Rápidas"** - Transformar em layout horizontal e posicionar ACIMA do Funil de Cotação

---

## Estrutura Atual do Dashboard

```
Banner de Boas-Vindas
Alertas
KPIs (4 cards)

Grid Principal (2/3 + 1/3):
├── Coluna Esquerda (2/3):
│   ├── Funil de Cotação
│   └── Últimos Leads        ← OCULTAR (exceto vendedores)
│
└── Coluna Direita (1/3):
    ├── Ações Rápidas        ← MOVER para acima do Funil
    └── Instalações Hoje
```

---

## Nova Estrutura Proposta

```
Banner de Boas-Vindas
Alertas
KPIs (4 cards)
Ações Rápidas (horizontal, full-width) ← NOVA POSIÇÃO

Grid Principal (2/3 + 1/3):
├── Coluna Esquerda (2/3):
│   ├── Funil de Cotação
│   └── Últimos Leads (apenas vendedores)
│
└── Coluna Direita (1/3):
    └── Instalações Hoje (coordenador/vistoriadores)
```

---

## Alterações no Arquivo `src/pages/Dashboard.tsx`

### 1. Mover Ações Rápidas para Layout Horizontal

Mover o card de Ações Rápidas para fora do grid de 3 colunas e posicioná-lo logo após os KPIs, antes do grid principal.

O card será exibido horizontalmente com os botões lado a lado em uma única linha.

### 2. Restringir Card "Últimos Leads"

Adicionar condição para exibir apenas para vendedores:

```typescript
// Antes (linhas 425-512):
<Card className="border-border bg-card">
  {/* Card Últimos Leads - sempre visível */}
</Card>

// Depois:
{isVendedorOnly && (
  <Card className="border-border bg-card">
    {/* Card Últimos Leads - apenas vendedores */}
  </Card>
)}
```

### 3. Ajustar Coluna Direita

Remover o card de Ações Rápidas da coluna direita (já foi movido para cima).

---

## Resultado Visual Esperado

Com base na imagem 2 de referência, o layout final será:

| Seção | Conteúdo |
|-------|----------|
| Topo | Banner + Alertas |
| KPIs | 4 cards em linha |
| **Ações Rápidas** | Botões horizontais (Nova Cotação + Novo Lead) |
| Grid Principal | Funil à esquerda, Instalações à direita (para perfis específicos) |
| Últimos Leads | Apenas visível para vendedores (abaixo do funil) |

---

## Visibilidade por Perfil

| Card | Vendedor | Coordenador | Vistoriador | Outros |
|------|----------|-------------|-------------|--------|
| Ações Rápidas | Visível | Visível | Visível | Visível |
| Funil de Cotação | Visível | Visível | Visível | Visível |
| Últimos Leads | Visível (só seus) | Oculto | Oculto | Oculto |
| Instalações Hoje | Oculto | Visível | Visível | Oculto |

---

## Seção Técnica

### Código do Card de Ações Rápidas (Nova Posição)

Será posicionado após os KPIs e antes do grid principal:

```typescript
{/* AÇÕES RÁPIDAS - HORIZONTAL */}
<Card className="border-border bg-card">
  <CardContent className="py-4">
    <div className="flex items-center gap-4">
      <h3 className="text-lg font-semibold text-foreground whitespace-nowrap">
        Ações Rápidas
      </h3>
      <div className="flex gap-3 flex-1">
        <QuickActions />
      </div>
    </div>
  </CardContent>
</Card>
```

### Ajuste no Componente QuickActions

Alterar o layout de `grid-cols-2` para `flex` horizontal:

```typescript
// Antes:
<div className="grid grid-cols-2 gap-2 sm:gap-3">

// Depois:
<div className="flex gap-3">
```

### Condição para Últimos Leads

```typescript
{isVendedorOnly && (
  // Card Últimos Leads existente
)}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Dashboard.tsx` | Mover Ações Rápidas, restringir Últimos Leads |
