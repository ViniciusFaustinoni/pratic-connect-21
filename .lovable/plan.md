
## Problema Identificado

Na página de **Propostas** (`src/pages/vendas/Contratos.tsx`), as abas do menu são hardcodeadas:
- Todos (0)
- Rascunho (0)
- Enviados (0)
- Assinados (0)
- Ativos (0)

O usuário quer que **apenas as abas com dados reais apareçam** no sistema.

## Solução Proposta

Tornar as abas dinâmicas filtrando apenas os statuses que existem nos contratos carregados:

### Lógica Implementada

1. **Calcular statuses únicos** presentes nos dados (ex: se não há contratos com status "rascunho", a aba não aparece)
2. **Manter a aba "Todos"** sempre visível como navegação geral
3. **Ordenar as abas** por uma sequência lógica de fluxo (novo → enviado → assinado → ativo)
4. **Filtrar abas com count = 0** a menos que o usuário as solicite

### Alterações no Arquivo

**Arquivo:** `src/pages/vendas/Contratos.tsx`

**Mudanças:**

1. **Linhas 120-138** - Substituir o array hardcodeado `tabs` por uma versão dinâmica:

```typescript
// Ordenação lógica do fluxo de contratos
const statusOrder: Record<StatusContrato, number> = {
  rascunho: 1,
  pendente: 2,
  pendente_assinatura: 3,
  enviado: 4,
  visualizado: 5,
  assinado: 6,
  ativo: 7,
  suspenso: 8,
  cancelado: 9,
  expirado: 10,
};

// Gerar abas dinamicamente com base nos dados reais
const getActiveTabs = () => {
  const uniqueStatuses = new Set(contratos?.map(c => c.status) || []);
  
  const activeTabs: { value: TabValue; label: string; count: number }[] = [
    { value: 'all', label: 'Todos', count: stats.total },
  ];

  // Adicionar abas apenas para statuses que existem
  const statusesToShow: StatusContrato[] = Array.from(uniqueStatuses)
    .sort((a, b) => (statusOrder[a] || 999) - (statusOrder[b] || 999));

  statusesToShow.forEach((status) => {
    const config = statusConfig[status];
    if (config) {
      const count = contratos?.filter(c => c.status === status).length || 0;
      activeTabs.push({
        value: status,
        label: config.label,
        count,
      });
    }
  });

  return activeTabs;
};

const tabs = getActiveTabs();
```

### Impacto

- **Abas vazias desaparecem** - Se não há "Rascunho", a aba não é exibida
- **Fluxo lógico mantido** - Abas aparecem em ordem de fluxo quando existem
- **"Todos" sempre visível** - Para visualização geral
- **Contadores precisos** - Cada aba mostra apenas seus dados reais

### Exemplo de Resultado

Se houver apenas:
- 2 contratos em "rascunho"
- 5 contratos em "enviado"
- 3 contratos em "ativo"

As abas exibidas serão:
- **Todos (10)**
- **Rascunho (2)**
- **Enviados (5)**
- **Ativos (3)**

(As abas "Assinados", "Pendentes", etc. não aparecem por não terem dados)
