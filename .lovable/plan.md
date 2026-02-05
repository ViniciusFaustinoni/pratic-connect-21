
## Funcionalidade: Adicionar Toggle de Tema na App do Associado

### Análise Atual

A aplicação do associado (`AppAssociadoLayout`) é uma tela mobile-first com:
- Header fixo com logo PRATIC e ícone de notificações
- Área de conteúdo com scroll vertical
- Bottom navigation fixa com 5 opções (Home, Boletos, Ajuda, Rastrear, Perfil)

O sistema de tema (`next-themes`) já está configurado globalmente na aplicação:
- `ThemeProvider` ativo em `src/App.tsx` com atributo `class` e tema `system` como padrão
- Componente reutilizável `ThemeToggle` existe em `src/components/ui/theme-toggle.tsx`
- A página `AppConfiguracoes.tsx` já implementa seleção de tema com botões de Light/Dark/System (linhas 635-650)

### Solução Proposta

Adicionar o **Theme Toggle** no header da `AppAssociadoLayout`, ao lado do ícone de notificações, para que o usuário possa trocar entre tema claro/escuro rapidamente.

### Implementação

**Arquivo a modificar:** `src/layouts/AppAssociadoLayout.tsx`

**Mudanças:**
1. Importar o componente `ThemeToggle` do caminho `@/components/ui/theme-toggle`
2. Adicionar o `ThemeToggle` no header, entre o logo e o ícone de notificações
3. Estilizar para ficar compacto e alinhado ao design mobile

**Estrutura esperada do header:**
```
┌─────────────────────────────────────────────────────┐
│ PRATIC  │  [Theme Toggle]  │  [Notification Icon]   │
└─────────────────────────────────────────────────────┘
```

### Detalhes Técnicos

- **Componente:** Reutilizar `ThemeToggle` existente (já suporta `mounted` state para SSR)
- **Estilo:** Usar a classe CSS do componente com ajuste de tamanho para mobile (`w-12 h-6` ou similar)
- **Acessibilidade:** O componente já tem `role="button"` e `aria-label` traduzido em português
- **Responsividade:** O toggle é compacto (w-14 h-7 padrão) e funciona bem em telas pequenas

### Benefícios

- ✅ Acesso rápido ao tema sem entrar em configurações
- ✅ Consistente com a UI da página `AppConfiguracoes.tsx`
- ✅ Melhora a experiência do usuário em telas noturnas
- ✅ Reutiliza componente existente (DRY principle)

