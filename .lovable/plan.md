

## Causa raiz

A página de lista de usuários foi consolidada em `/configuracoes/usuarios-acessos` (ver `App.tsx` linha 692). A rota antiga `/configuracoes/usuarios` foi removida do router, mas o `UsuarioForm.tsx` ainda navega para ela em 3 pontos:

- **Linha 482** — `onSuccess` do mutation: após criar/editar, `navigate('/configuracoes/usuarios')` → 404.
- **Linha 523** — botão "voltar" (seta no header) → 404.
- **Linha 839** — botão "Cancelar" → 404.

O toast "Usuário atualizado!" aparece (mutation OK) e logo em seguida cai no NotFound (visível no print 2).

## Correção

Em `src/pages/configuracoes/UsuarioForm.tsx`, trocar as 3 ocorrências de:
```ts
navigate('/configuracoes/usuarios')
```
por:
```ts
navigate('/configuracoes/usuarios-acessos')
```

## Auditoria adicional

`src/pages/configuracoes/UsuariosAcessos.tsx` linhas 307, 436, 493 e `Vendedores.tsx` linha 81 e `VendedorHistorico.tsx` linha 146 navegam para `/configuracoes/usuarios/novo` e `/configuracoes/usuarios/:id`. **Essas rotas existem** (App.tsx 693-694) — apontam para `UsuarioForm`. Não precisam ser alteradas.

A única rota quebrada é a lista (`/configuracoes/usuarios` sem sufixo).

## Validação

1. Editar um usuário existente e clicar "Salvar alterações" → deve voltar pra `/configuracoes/usuarios-acessos` com a lista (sem 404).
2. Criar um novo usuário → mesmo comportamento.
3. Clicar em "Cancelar" ou na seta de voltar → mesmo comportamento.

## Resultado

Fim do 404 pós-criação/edição de usuário. Fluxo retorna pra lista correta.

