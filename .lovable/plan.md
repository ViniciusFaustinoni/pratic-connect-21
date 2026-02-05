

## Problema Identificado

Na página atual, o menu "Ouvidoria" é exibido para Vendedores/Consultores (vendedor_clt e vendedor_externo), mas não deveria estar visível para eles. 

Analisando o código:
- **Arquivo:** `src/hooks/usePermissions.ts` (linha 255)
- **Lógica atual:** `canManageOuvidoria: isDiretor || hasRole('gerente_comercial') || hasRole('analista_cadastro') || isFuncionario() || isDesenvolvedor`

Vendedores têm apenas os roles `vendedor_clt` ou `vendedor_externo`, então teoricamente não deveriam ter acesso. Porém, a verificação de permissão está correta.

**A solução é simples:** Remover a permissão `canManageOuvidoria` da lógica de permissões de Vendedor/Consultor, ou ajustar a permissão para excluir explicitamente esses perfis.

## Solução Proposta

Há duas abordagens possíveis:

### Opção 1 (Recomendada): Ajustar Ouvidoria para excluir Vendedor
Modificar a permissão em `src/hooks/usePermissions.ts` (linha 255) para ser mais explícita e segura, adicionando uma verificação negativa para vendedores.

```typescript
canManageOuvidoria: (isDiretor || hasRole('gerente_comercial') || hasRole('analista_cadastro') || isFuncionario() || isDesenvolvedor) && !isVendedorCotacao
```

### Opção 2: Adicionar filtro no AppSidebar
Adicionar lógica no `src/components/layout/AppSidebar.tsx` para excluir o grupo "Ouvidoria" para vendedores especificamente no método `getVisibleGroups()`.

## Recomendação

**Opção 1 é melhor** porque:
1. Fix no nível de permissões (source of truth)
2. Garante segurança em qualquer lugar que use `canManageOuvidoria`
3. Mantém a lógica centralizada e reutilizável
4. Mais simples de manter e debugar

## Mudança Técnica

**Arquivo:** `src/hooks/usePermissions.ts` (linha 255)

Modificar:
```typescript
canManageOuvidoria: isDiretor || hasRole('gerente_comercial') || hasRole('analista_cadastro') || isFuncionario() || isDesenvolvedor,
```

Para:
```typescript
canManageOuvidoria: (isDiretor || hasRole('gerente_comercial') || hasRole('analista_cadastro') || isFuncionario() || isDesenvolvedor) && !isVendedorCotacao,
```

Essa mudança:
- Mantém o acesso para Diretor, Gerente Comercial, Analista de Cadastro, Funcionário e Desenvolvedor
- **Bloqueia** explicitamente para Vendedor CLT e Vendedor Externo
- É aplicada globalmente em toda a aplicação

## Resultado

Após a mudança, Vendedores e Consultores não verão o menu "Ouvidoria" no sidebar, mesmo que tenha outras permissões.

