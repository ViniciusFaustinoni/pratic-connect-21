

# Correção: Foto de perfil não atualiza

## Problema

Em `MeuPerfil.tsx`, após o upload do avatar, o código faz `queryClient.invalidateQueries({ queryKey: ['auth-user'] })` — mas essa query **não existe**. O AuthContext usa estado local (`setProfile`), não react-query.

Resultado: a foto atualiza no banco e no estado local do componente, mas o `profile` do AuthContext (usado pelo sidebar, header, etc.) mantém o `avatar_url` antigo. A foto não reflete em lugar nenhum além da própria página de perfil.

## Correção

Em `MeuPerfil.tsx`, após upload/remoção bem-sucedida, chamar `updateProfile` do AuthContext (que já existe e aceita `avatar_url`) em vez de apenas invalidar uma query inexistente. Isso atualiza o estado global e reflete imediatamente no sidebar e header.

### Arquivo: `src/pages/configuracoes/MeuPerfil.tsx`

**Upload (handleCropComplete)**: Após o update no banco, chamar `updateProfile({ avatar_url: publicUrl })` do AuthContext para sincronizar o estado global. Remover o `invalidateQueries` inútil.

**Remoção (handleRemoveAvatar)**: Após limpar no banco, chamar `updateProfile({ avatar_url: null })`. Remover o `invalidateQueries` inútil.

Desestruturar `updateProfile` de `useAuth()` (já disponível no contexto).

