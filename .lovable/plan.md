

# Plano: Mover "Encaixes" para dentro de "Instalações e Vistorias"

## Resumo

Consolidar "Encaixes" como terceira aba na pagina VistoriasInstalacoesMon.tsx e remover o item separado do sidebar.

---

## Alteracoes

### 1. `src/components/layout/AppSidebar.tsx`

Remover a linha:
```tsx
{ title: 'Encaixes', url: '/monitoramento/encaixes', icon: CalendarCheck },
```

### 2. `src/pages/monitoramento/VistoriasInstalacoesMon.tsx`

Adicionar terceira aba "Encaixes":

- Import `Puzzle` do lucide-react e `MonitoramentoEncaixes` (com prop `embedded`)
- Nova TabsTrigger "Encaixes" com icone Puzzle
- Novo TabsContent renderizando `<MonitoramentoEncaixes embedded />`

### 3. `src/pages/monitoramento/Encaixes.tsx`

Adicionar prop `embedded?: boolean` ao componente `MonitoramentoEncaixes`. Quando `embedded={true}`, ocultar o header (titulo, descricao, botao Atualizar) para evitar duplicacao visual.

### 4. `src/App.tsx`

Manter a rota `/monitoramento/encaixes` como redirect para `/monitoramento/vistorias-instalacoes-mon` (backward compatibility).

---

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| `src/components/layout/AppSidebar.tsx` | Remover item "Encaixes" |
| `src/pages/monitoramento/VistoriasInstalacoesMon.tsx` | Nova aba Encaixes |
| `src/pages/monitoramento/Encaixes.tsx` | Prop `embedded` para ocultar header |
| `src/App.tsx` | Redirect da rota antiga |

