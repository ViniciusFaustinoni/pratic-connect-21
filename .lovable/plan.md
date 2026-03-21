

# Plano: Unificar Instalações e Vistorias em um único menu no Monitoramento

## O que muda

No menu Monitoramento, os dois itens separados "Instalações" e "Vistorias" serão substituídos por um único item "Vistorias e Instalações" que aponta para uma página unificada com abas.

## Alterações

### 1. `AppSidebar.tsx`
- **Remover** as linhas 198-199 (itens separados "Instalações" e "Vistorias")
- **Adicionar** um único item: `{ title: 'Vistorias e Instalações', url: '/monitoramento/vistorias-instalacoes', icon: ClipboardList }`

### 2. `App.tsx`
- Adicionar rota `/monitoramento/vistorias-instalacoes` apontando para uma nova página unificada
- Adicionar redirects de `/monitoramento/instalacoes` e `/monitoramento/vistorias` para `/monitoramento/vistorias-instalacoes`

### 3. Nova página: `src/pages/monitoramento/VistoriasInstalacoes.tsx`
- Página com tabs: **Instalações** | **Vistorias**
- Aba "Instalações" renderiza o conteúdo atual de `Instalacoes.tsx` (lista de instalações com filtros e busca)
- Aba "Vistorias" renderiza o conteúdo atual de `Vistorias.tsx` (lista de vistorias com métricas e busca)
- Reutiliza os mesmos hooks e componentes existentes

### 4. Diretoria mantida
- O item "Vistorias e Instalações" na Diretoria (`/diretoria/vistorias-instalacoes`) permanece como está -- é a visão do diretor com rotas, tempo real e movimentações.

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/layout/AppSidebar.tsx` | Substituir 2 itens por 1 |
| `src/pages/monitoramento/VistoriasInstalacoes.tsx` | **Novo** -- página unificada com abas |
| `src/App.tsx` | Nova rota + redirects |

