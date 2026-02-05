
## Adicionar Opção de Dark/Light Mode no App do Associado

### Problema Identificado

O app do associado não possui uma opção visível para mudar entre os modos Dark e Light. Enquanto o sistema já tem `ThemeProvider` configurado e um componente `ThemeToggle` pronto, ele não está sendo utilizado na interface do associado.

### Análise da Arquitetura Atual

**Infraestrutura existente:**
- `App.tsx` (linha 296): `ThemeProvider` já configurado com `attribute="class"` e `defaultTheme="system"`
- `src/components/ui/theme-toggle.tsx`: Componente ThemeToggle totalmente funcional com:
  - Detecção automática do tema do sistema
  - Switch visual intuitivo (Sol ☀️ / Lua 🌙)
  - Textos descritivos em português
  - Suporte a animações

**Layout do Associado:**
- `src/components/app/AppHeader.tsx`: Header fixo com logo, navegação e dropdown de usuário
- `src/components/app/AppUserDropdown.tsx`: Menu dropdown com opções de perfil, documentos, sinistros, configurações e logout

### Solução Proposta

Adicionar o toggle de tema como um item no dropdown do usuário (`AppUserDropdown.tsx`), mantendo a interface limpa e consistente.

**Por que no dropdown?**
- Interface mobile-first: espaço limitado no header em mobile
- Consistência UX: agrupa todas as preferências do usuário em um único menu
- Padrão visual: similar ao que já existe em layout de colaboradores
- Fácil acesso: sempre disponível sem poluir a navegação

### Alterações Necessárias

#### Arquivo: `src/components/app/AppUserDropdown.tsx`

**Adições:**
1. Importar `ThemeToggle` do componente existente
2. Importar `Separator` do Radix UI (já usado no projeto)
3. Adicionar o ThemeToggle como seção separada no dropdown, logo abaixo da opção de Configurações

**Estrutura final do dropdown:**
```
├── Meus Dados
├── Documentos
├── Sinistros
├── Configurações
├── ─────────────── (Separator)
├── [Toggle] Modo Escuro/Claro
├── ─────────────── (Separator)
└── Sair
```

### Comportamento Esperado

**Antes:**
- Usuário só conseguia mudar tema através de configurações do navegador/SO
- Sem opção nativa na aplicação

**Depois:**
- Usuário clica no avatar/dropdown
- Vê a opção de toggle de tema (Sun ☀️ / Moon 🌙)
- Clica para trocar entre Light e Dark Mode
- Tema persiste usando localStorage via `next-themes`
- Tema se aplica imediatamente com transição suave

### Impacto

- ✅ Não requer alterações no banco de dados
- ✅ Usa componente já pronto e testado
- ✅ Mantém interface limpa
- ✅ Acessível em mobile e desktop
- ✅ Sem mudanças em configurações de tema global

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/app/AppUserDropdown.tsx` | Adicionar imports + integrar ThemeToggle no dropdown |

