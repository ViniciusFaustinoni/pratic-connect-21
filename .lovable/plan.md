

## Plano: Criar seção "Regras de Venda" no módulo Diretoria

### Arquivos a criar

**1. `src/pages/diretoria/RegrasVenda.tsx`**
- Página com layout de abas horizontais usando `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` do shadcn
- Primeira aba: "Pontuação do Consultor" com título e texto explicativo placeholder
- Estrutura extensível: cada aba futura será apenas um novo `TabsTrigger` + `TabsContent`

### Arquivos a modificar

**2. `src/App.tsx`**
- Importar `RegrasVenda` de `./pages/diretoria/RegrasVenda`
- Adicionar rota: `<Route path="/diretoria/regras-venda" element={<RegrasVenda />} />`

**3. `src/components/layout/AppSidebar.tsx`**
- Adicionar item no grupo `diretoria.items`: `{ title: 'Regras de Venda', url: '/diretoria/regras-venda', icon: Gavel }` (ou `ScrollText`)
- Posicionar após "Gestão Comercial"

**4. `src/components/layout/GlobalBreadcrumb.tsx`**
- Adicionar entrada: `'/diretoria/regras-venda': { label: 'Regras de Venda' }`

### Permissão
- O grupo `diretoria` já tem `permission: 'isDiretorOnly'`, então a seção inteira (incluindo o novo item) só aparece para diretores. Nenhuma alteração de permissão necessária.

### Estrutura da página

```text
┌─────────────────────────────────────────────┐
│  Regras de Venda                    (título)│
│  Texto descritivo                           │
├─────────────────────────────────────────────┤
│ [Pontuação do Consultor] [aba futura] [...] │
├─────────────────────────────────────────────┤
│                                             │
│  Pontuação do Consultor                     │
│  As regras de pontuação do consultor serão  │
│  configuradas aqui.                         │
│                                             │
└─────────────────────────────────────────────┘
```

