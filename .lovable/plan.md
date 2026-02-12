

# Remover apenas o item "Empresa" do menu Configurações

## Problema

O item "Empresa (Dados da associação)" dentro da seção "Geral" do menu Configurações não deveria existir ali, pois essa funcionalidade já está corretamente implementada em **Diretoria > Configurações**. Os demais itens (Integrações e Sistema) devem permanecer.

## Alterações

| Arquivo | Ação |
|---|---|
| `src/pages/configuracoes/components/ConfiguracoesSidebar.tsx` | Remover o item `{ path: '/configuracoes/empresa', label: 'Empresa', icon: Building2 }` do array |
| `src/pages/configuracoes/components/ConfiguracoesMobileNav.tsx` | Remover o mesmo item do menu mobile |
| `src/App.tsx` | Remover a rota `/configuracoes/empresa` e o import de `Empresa` (se usado apenas ali) |
| `src/pages/configuracoes/index.tsx` | Remover o export de `Empresa` |

## O que permanece

- Seção "Conta": Meu Perfil, Segurança, Notificações
- Seção "Administração": Usuários e Acessos
- Seção "Geral": Integrações, Sistema (sem Empresa)

