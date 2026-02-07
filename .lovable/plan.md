
# Plano: Unificar Cotacao via Modal e Remover Pagina Cotador

## Problema Identificado

Atualmente existem **duas formas** de criar cotacoes no sistema:
1. **Modal `CotacaoFormDialog`** - Acessado via botao "Nova Cotacao" na pagina `/vendas/cotacoes` (imagem 2)
2. **Pagina `/vendas/cotador`** - Uma pagina separada e completa (imagem 3)

O usuario solicita que a **unica forma** de criar cotacoes seja atraves do **modal**, eliminando a pagina Cotador.

---

## Locais que Referenciam `/vendas/cotador`

| Arquivo | Linha | Referencia |
|---------|-------|------------|
| `src/pages/Dashboard.tsx` | 252 | Acao rapida "Nova Cotacao" |
| `src/components/layout/GlobalSearch.tsx` | 20 | Pagina "Cotador" |
| `src/components/layout/GlobalSearch.tsx` | 34 | Acao rapida "Nova Cotacao" |
| `src/components/layout/GlobalBreadcrumb.tsx` | 23 | Mapeamento de breadcrumb |
| `src/pages/vendas/LeadKanban.tsx` | 243 | Acao "cotacao" no kanban |
| `src/App.tsx` | 45 | Import do componente |
| `src/App.tsx` | 362 | Rota `/vendas/cotador` |

---

## Estrategia de Implementacao

### Abordagem: Redirect para Cotacoes com Modal Aberto

Em vez de navegar para `/vendas/cotador`, todos os locais irao navegar para `/vendas/cotacoes?novo=true` (ou similar), que abrira automaticamente o modal de cotacao.

A pagina `Cotacoes.tsx` ja suporta isso parcialmente via `?lead=ID`.

---

## Arquivos a Modificar

### 1. `src/pages/vendas/Cotacoes.tsx`

**Alteracao**: Adicionar suporte ao parametro `?novo=true` para abrir o modal automaticamente.

```typescript
// Atual (linha 166-174)
useEffect(() => {
  const leadParam = searchParams.get('lead');
  if (leadParam) {
    setLeadIdFromUrl(leadParam);
    setShowCotacaoForm(true);
    // ...
  }
}, [searchParams, setSearchParams]);

// Novo
useEffect(() => {
  const leadParam = searchParams.get('lead');
  const novoParam = searchParams.get('novo');
  
  if (leadParam) {
    setLeadIdFromUrl(leadParam);
    setShowCotacaoForm(true);
    searchParams.delete('lead');
    setSearchParams(searchParams, { replace: true });
  } else if (novoParam === 'true') {
    setShowCotacaoForm(true);
    searchParams.delete('novo');
    setSearchParams(searchParams, { replace: true });
  }
}, [searchParams, setSearchParams]);
```

### 2. `src/pages/Dashboard.tsx`

**Alteracao**: Mudar URL da acao "Nova Cotacao" de `/vendas/cotador` para `/vendas/cotacoes?novo=true`.

```typescript
// Linha 252
// Antes:
url: '/vendas/cotador',

// Depois:
url: '/vendas/cotacoes?novo=true',
```

### 3. `src/components/layout/GlobalSearch.tsx`

**Alteracao**: 
- Remover "Cotador" da lista de paginas
- Mudar URL da acao rapida "Nova Cotacao"

```typescript
// Linha 20 - REMOVER:
{ name: 'Cotador', url: '/vendas/cotador', ... },

// Linha 34 - ALTERAR:
// Antes:
{ name: 'Nova Cotação', url: '/vendas/cotador', ... },

// Depois:
{ name: 'Nova Cotação', url: '/vendas/cotacoes?novo=true', ... },
```

### 4. `src/pages/vendas/LeadKanban.tsx`

**Alteracao**: Mudar navegacao do botao "Cotacao" no kanban para abrir modal via Cotacoes.

```typescript
// Linhas 242-255
// Antes:
case 'cotacao':
  navigate('/vendas/cotador', {
    state: { leadId: lead.id, ... }
  });
  break;

// Depois:
case 'cotacao':
  navigate(`/vendas/cotacoes?lead=${lead.id}`);
  break;
```

A pagina Cotacoes ja suporta o parametro `?lead=ID` e preenche o modal com os dados do lead automaticamente.

### 5. `src/App.tsx`

**Alteracao**: 
- Remover import do Cotador
- Mudar rota `/vendas/cotador` para redirect

```typescript
// Linha 45 - REMOVER:
import Cotador from "./pages/vendas/Cotador";

// Linha 362 - ALTERAR:
// Antes:
<Route path="/vendas/cotador" element={<Cotador />} />

// Depois (redirect para manter links antigos funcionando):
<Route path="/vendas/cotador" element={<Navigate to="/vendas/cotacoes?novo=true" replace />} />
```

### 6. `src/components/layout/GlobalBreadcrumb.tsx`

**Alteracao**: Remover mapeamento de breadcrumb para `/vendas/cotador`.

```typescript
// Linha 23 - REMOVER:
'/vendas/cotador': { label: 'Cotador' },
```

---

## Pagina a Manter (Nao Deletar)

O arquivo `src/pages/vendas/Cotador.tsx` sera **mantido** no projeto por enquanto, pois:
1. O redirect garante retrocompatibilidade
2. Pode haver links externos ou bookmarks
3. Pode ser util para referencia futura

Alternativamente, podemos deletar o arquivo se preferir.

---

## Fluxo Apos Implementacao

```text
Usuario clica "Nova Cotacao" (Dashboard, GlobalSearch, etc.)
         │
         ▼
Navega para: /vendas/cotacoes?novo=true
         │
         ▼
Pagina Cotacoes detecta parametro "novo=true"
         │
         ▼
Modal CotacaoFormDialog abre automaticamente
         │
         ▼
Usuario preenche cotacao no modal
         │
         ▼
Cotacao salva e aparece na lista
```

---

## Resultado Esperado

| Acao do Usuario | Comportamento Atual | Comportamento Novo |
|-----------------|--------------------|--------------------|
| Clicar "Nova Cotacao" no Dashboard | Abre pagina Cotador | Abre modal na pagina Cotacoes |
| Clicar "Nova Cotacao" no GlobalSearch | Abre pagina Cotador | Abre modal na pagina Cotacoes |
| Clicar "Cotacao" no Kanban de Leads | Abre pagina Cotador com dados do lead | Abre modal na pagina Cotacoes com dados do lead |
| Acessar URL `/vendas/cotador` diretamente | Abre pagina Cotador | Redireciona para Cotacoes com modal aberto |

---

## Secao Tecnica

### Arquivos Modificados

| Arquivo | Tipo de Alteracao |
|---------|-------------------|
| `src/pages/vendas/Cotacoes.tsx` | Adicionar suporte a `?novo=true` |
| `src/pages/Dashboard.tsx` | Mudar URL da acao rapida |
| `src/components/layout/GlobalSearch.tsx` | Remover pagina + mudar URL acao |
| `src/components/layout/GlobalBreadcrumb.tsx` | Remover entrada |
| `src/pages/vendas/LeadKanban.tsx` | Mudar navegacao |
| `src/App.tsx` | Redirect da rota antiga |

### Arquivos Opcionais para Deletar

| Arquivo | Motivo |
|---------|--------|
| `src/pages/vendas/Cotador.tsx` | Pagina obsoleta (1607 linhas) |

---

## Ordem de Implementacao

1. Modificar `Cotacoes.tsx` para detectar `?novo=true`
2. Atualizar `Dashboard.tsx` (acao rapida)
3. Atualizar `GlobalSearch.tsx` (paginas + acoes)
4. Atualizar `LeadKanban.tsx` (navegacao)
5. Atualizar `App.tsx` (redirect)
6. Remover breadcrumb em `GlobalBreadcrumb.tsx`
7. (Opcional) Deletar `Cotador.tsx`
