
# Centralizar gestao de permissoes em Configuracoes > Usuarios e Acessos

## Situacao atual

A pagina **Usuarios e Acessos** (`/configuracoes/usuarios-acessos`) possui 4 abas:
- Usuarios
- Vendedores
- Perfis de Acesso (atribuicao basica de roles)
- Logs de Atividade

A **Matriz de Visibilidade** (controle de quais modulos/abas cada perfil pode ver e editar) esta separada em outro componente (`Perfis.tsx`), acessivel apenas em `/diretoria/perfis`.

O usuario quer que **tudo** fique centralizado em Configuracoes > Usuarios e Acessos.

## Plano

### 1. Adicionar aba "Visibilidade" ao UsuariosAcessos

Adicionar uma 5a aba chamada **"Visibilidade de Modulos"** (com icone `Grid3X3` ou `Eye`) na pagina `UsuariosAcessos.tsx`. O conteudo dessa aba sera o componente `Perfis` importado de `src/pages/configuracoes/Perfis.tsx`, renderizado diretamente como conteudo da tab.

Isso traz para dentro de Usuarios e Acessos:
- Cards de perfis com descricoes e contagem de usuarios
- Matriz de Visibilidade (toggles por modulo x perfil)
- Controle de can_edit (permissao de edicao por modulo)
- Visibilidade de sub-itens (abas especificas dentro de cada modulo)
- Gerenciamento de roles
- Solicitacoes de alteracao

### 2. Atualizar rota /diretoria/perfis

Redirecionar `/diretoria/perfis` para `/configuracoes/usuarios-acessos?tab=visibilidade` para que quem acessar pelo menu antigo chegue ao local correto.

### 3. Atualizar sidebar de Configuracoes

O menu lateral ja aponta para `/configuracoes/usuarios-acessos`. Nenhuma alteracao necessaria no sidebar.

## Resumo de arquivos

| Arquivo | Alteracao |
|---|---|
| `src/pages/configuracoes/UsuariosAcessos.tsx` | Adicionar aba "Visibilidade" que renderiza o componente Perfis |
| `src/App.tsx` | Alterar rota `/diretoria/perfis` para redirect a `/configuracoes/usuarios-acessos?tab=visibilidade` |

## Resultado

Toda a gestao de usuarios, roles, visibilidade de modulos/abas, permissoes de edicao e logs ficara centralizada em um unico local: **Configuracoes > Usuarios e Acessos**, com 5 abas organizadas.
