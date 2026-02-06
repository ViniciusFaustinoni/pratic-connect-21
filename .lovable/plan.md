
## Plano: Permitir Diretor Excluir Veículo da Blacklist

### Problema Identificado

A página de Blacklist (`src/pages/diretoria/Blacklist.tsx`) já possui:
- O botão de exclusão implementado (linha 222-230)
- O hook `useRemoverBlacklist` funcionando corretamente

**Porém**, a condição atual usa `isDiretorOnly`:

```typescript
{isDiretorOnly && (
  <Button variant="ghost" size="icon" onClick={() => setConfirmarRemocao(item.id)}>
    <Trash2 className="h-4 w-4 text-destructive" />
  </Button>
)}
```

O `isDiretorOnly` retorna `true` **apenas** se o usuario for diretor **sem nenhum outro perfil**. Se o diretor também tiver perfis como `desenvolvedor` ou `admin_master`, o botão não aparece.

### Solucao

Modificar a condição para usar `isDiretor` (que verifica se o usuario TEM o perfil diretor) ou criar uma permissão mais abrangente que inclua diretores, desenvolvedores e admin_master.

A melhor abordagem é verificar se o usuario pode gerenciar a blacklist usando:
```typescript
(isDiretor || isDesenvolvedor || isAdminMaster)
```

Isso garante que:
1. Diretores possam excluir (independente de outros perfis)
2. Desenvolvedores e Admins Master também possam (por serem perfis de gestão)

---

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/diretoria/Blacklist.tsx` | Alterar condição de `isDiretorOnly` para verificação mais abrangente |

---

### Alterações

**Linha 49 - Adicionar permissões necessárias:**
```typescript
// Antes:
const { isDiretorOnly } = usePermissions();

// Depois:
const { isDiretor, isDesenvolvedor, isAdminMaster } = usePermissions();
const canManageBlacklist = isDiretor || isDesenvolvedor || isAdminMaster;
```

**Linha 222 - Alterar condição do botão de exclusão:**
```typescript
// Antes:
{isDiretorOnly && (
  <Button variant="ghost" size="icon" onClick={() => setConfirmarRemocao(item.id)}>
    <Trash2 className="h-4 w-4 text-destructive" />
  </Button>
)}

// Depois:
{canManageBlacklist && (
  <Button variant="ghost" size="icon" onClick={() => setConfirmarRemocao(item.id)}>
    <Trash2 className="h-4 w-4 text-destructive" />
  </Button>
)}
```

---

### Resultado Esperado

Após a alteração:
- Diretores (com ou sem outros perfis) poderão excluir veículos da blacklist
- Desenvolvedores e Admin Master também terão essa permissão
- O botão de lixeira aparecerá na coluna "Ações" da tabela
- O fluxo de confirmação com dialog continuará funcionando
- O veículo será marcado como `ativo: false` (soft delete) mantendo histórico
