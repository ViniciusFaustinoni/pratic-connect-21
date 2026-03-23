

# Plano: Mover "Gestao de Rotas" para dentro de "Vistorias e Instalacoes"

## Resumo

Remover "Gestao de Rotas" como item separado na sidebar da Diretoria e adiciona-lo como uma nova aba dentro da pagina Rotas.tsx (que e renderizada em `/diretoria/vistorias-instalacoes`).

---

## Alteracoes

### 1. `src/components/layout/AppSidebar.tsx`

Remover a linha:
```tsx
{ title: 'Gestão de Rotas', url: '/diretoria/gestao-vistorias-instalacoes', icon: Route },
```

### 2. `src/pages/monitoramento/Rotas.tsx`

Adicionar nova aba "Gestao de Rotas" na TabsList (visivel apenas para quem tem `canEditRotas`):

```tsx
{canEditRotas && (
  <TabsTrigger value="gestao-rotas">
    <Route className="mr-1 h-4 w-4" />
    Gestão de Rotas
  </TabsTrigger>
)}
```

Adicionar o TabsContent correspondente que renderiza o componente `GestaoRotas` inline (importado de `./GestaoRotas`), sem o header proprio dele (ja que o header da pagina Rotas.tsx cobre isso).

### 3. `src/pages/monitoramento/GestaoRotas.tsx`

Exportar tambem uma versao "embedded" sem header, ou adicionar prop `embedded?: boolean` que oculta o titulo/descricao quando renderizado como aba.

### 4. Rota no `App.tsx`

Manter a rota `/diretoria/gestao-vistorias-instalacoes` como redirect para `/diretoria/vistorias-instalacoes` (para links antigos nao quebrarem).

---

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| `src/components/layout/AppSidebar.tsx` | Remover item "Gestao de Rotas" |
| `src/pages/monitoramento/Rotas.tsx` | Nova aba + import GestaoRotas |
| `src/pages/monitoramento/GestaoRotas.tsx` | Prop `embedded` para ocultar header |
| `src/App.tsx` | Redirect da rota antiga |

