## Objetivo

Mover o botão **"Deslogar todos os usuários"** (que estava órfão em `/configuracoes/perfis`, hoje 404) para **Configurações › Usuários e Acessos › aba Usuários**, sem alterar a edge function `deslogar-todos-usuarios`.

## Passos

### 1. Extrair o botão para componente reutilizável

Criar `src/components/configuracoes/DeslogarTodosUsuariosButton.tsx` com o código atual do `DeslogarTodosButton` que vive em `src/pages/configuracoes/Perfis.tsx` (linhas 41–91):

- Mantém `AlertDialog` de confirmação
- Mantém chamada `supabase.functions.invoke('deslogar-todos-usuarios')`
- Mantém toast com `total_deslogados`
- Mantém variant `destructive` + ícone `LogOut`

Sem mudanças de lógica — só extração.

### 2. Colocar na aba "Usuários"

Em `src/pages/configuracoes/UsuariosAcessos.tsx`, dentro do `<TabsContent value="usuarios">` (linha 186), adicionar uma **action bar** logo acima do `<Card>` de Gerenciamento:

```tsx
<div className="flex justify-end">
  <DeslogarTodosUsuariosButton />
</div>
<Card>...</Card>
```

Posição alinhada à direita, fora do Card, para destacar o caráter destrutivo. Mantém estética da página (não polui o header global de "Novo usuário"/"Exportar", que são ações positivas).

### 3. Gating por permissão

Hoje a proteção é só na edge function (Diretor). Acrescentar guard no front para esconder o botão de quem não vai conseguir executar:

```tsx
const { hasRole } = usePermissions();
if (!hasRole('diretor')) return null;
```

Evita expor a ação a perfis sem permissão (UX) sem trocar a regra de autorização real (que continua server-side).

### 4. Limpeza do arquivo Perfis.tsx órfão

Verificar em `src/App.tsx` se `/configuracoes/perfis` ainda tem rota:

- **Se não tem rota** (provável, dado o 404): apagar `src/pages/configuracoes/Perfis.tsx` inteiro para não deixar arquivo morto. Ou, no mínimo, remover o `DeslogarTodosButton` interno e qualquer referência ao caminho na sidebar/nav.
- **Se tem rota mas quebrada**: ainda assim remover o botão de lá (já está na nova casa) e decidir com você se a página inteira deve sair ou se outra coisa deveria viver nela.

Vou reportar o que encontrar antes de apagar Perfis.tsx para você confirmar.

### 5. QA

- Abrir `/configuracoes/usuarios-acessos`, aba **Usuários** → botão visível para Diretor, escondido para os outros perfis testados.
- Clicar → `AlertDialog` de confirmação → "Sim, deslogar todos" → toast com contagem.
- Confirmar que sua sessão de Diretor segue ativa.
- Conferir log de auditoria (mesmo log que a edge já grava — não mexemos nela).

## Fora de escopo

- Lógica da edge `deslogar-todos-usuarios` (intocada).
- Auditoria server-side (já existe).
- Reaproveitar o botão em outras telas (se quiser depois, é trivial — o componente já está extraído).
