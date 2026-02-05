
## Problema Identificado

Na página de detalhes do associado (`src/pages/cadastro/AssociadoDetalhe.tsx`), na seção "Últimas Faturas" (linhas 1350-1356), há um botão "Ver todas" com ícone de ExternalLink que o usuário quer remover.

## Solução Proposta

Remover completamente o botão "Ver todas" mantendo apenas o título "Últimas Faturas".

### Mudanças no Arquivo

**Arquivo:** `src/pages/cadastro/AssociadoDetalhe.tsx`

**Alteração específica (linhas 1351-1355):**
- **Atual:** CardHeader com flex layout contendo título e botão "Ver todas"
- **Novo:** CardHeader mantendo apenas o título "Últimas Faturas"

**Antes:**
```typescript
<CardHeader className="flex flex-row items-center justify-between">
  <CardTitle className="text-base">Últimas Faturas</CardTitle>
  <Button variant="outline" size="sm">
    <ExternalLink className="mr-2 h-4 w-4" /> Ver todas
  </Button>
</CardHeader>
```

**Depois:**
```typescript
<CardHeader>
  <CardTitle className="text-base">Últimas Faturas</CardTitle>
</CardHeader>
```

### Impacto

- ✅ Botão "Ver todas" removido da seção de Faturas
- ✅ Interface mais simples e focada
- ✅ Usuários continuam visualizando as últimas faturas na tabela
- ✅ Sem impacto em outras funcionalidades
