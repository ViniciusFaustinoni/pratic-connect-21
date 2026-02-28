

# Corrigir a pagina de Perfis em /diretoria/perfis

## Problema

A rota `/diretoria/perfis` esta renderizando o componente `PerfisAcesso` (pagina simples de atribuicao de roles), enquanto a funcionalidade completa de **Matriz de Visibilidade** (controle de quais modulos e abas cada perfil pode ver/editar) esta no componente `Perfis` de `src/pages/configuracoes/Perfis.tsx`.

O usuario espera encontrar o controle de visibilidade em `/diretoria/perfis`, mas la so aparece uma lista basica de cards de perfis e atribuicao de roles por usuario.

## Solucao

Unificar as duas paginas: fazer `/diretoria/perfis` renderizar o componente completo que ja inclui a matriz de visibilidade, lista de perfis e gerenciamento de roles.

## Alteracoes

### 1. Atualizar rota em `src/App.tsx`

Trocar o componente usado na rota `/diretoria/perfis` de `PerfisAcesso` para o componente `Perfis` de configuracoes que ja possui toda a funcionalidade:

- Importar `Perfis` de `src/pages/configuracoes/Perfis.tsx` (ja importado como `Perfis` na linha 116)
- Alterar a rota `/diretoria/perfis` de `<PerfisAcesso />` para `<Perfis />`

### 2. Manter `PerfisAcesso` como fallback

O arquivo `src/pages/diretoria/PerfisAcesso.tsx` pode ser mantido sem alteracoes por enquanto, caso seja usado em outro lugar futuramente.

## Resumo de arquivos

| Arquivo | Alteracao |
|---|---|
| `src/App.tsx` (linha 613) | Trocar `PerfisAcesso` por `Perfis` na rota `/diretoria/perfis` |

