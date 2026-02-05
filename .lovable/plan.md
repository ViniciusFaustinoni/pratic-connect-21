
# Plano: Ocultar Botão "Nova Proposta" para Vendedor

## Objetivo
O vendedor não deve visualizar o botão "Nova Proposta" na tela de Propostas (`/vendas/contratos`). A criação de propostas deve ocorrer exclusivamente a partir de cotações, permitindo ao vendedor apenas visualizar os detalhes de propostas existentes.

---

## Análise do Código Atual

**Arquivo:** `src/pages/vendas/Contratos.tsx`

O botão "Nova Proposta" está localizado nas linhas 298-301:

```tsx
<Button onClick={() => setFormDialogOpen(true)}>
  <Plus className="mr-2 h-4 w-4" />
  Nova Proposta
</Button>
```

O arquivo já importa `usePermissions` (linha 8), mas atualmente só utiliza para verificar permissão de exclusão:

```tsx
const { isDiretor, isDesenvolvedor, isAdminMaster } = usePermissions();
const canDeleteContratos = isDiretor || isDesenvolvedor || isAdminMaster;
```

---

## Solução Proposta

### 1. Utilizar `isVendedorOnly` do hook `usePermissions`

O hook já possui a flag `isVendedorOnly` que foi adicionada recentemente para ajustes no Dashboard.

### 2. Envolver o botão em condicional

Mostrar o botão apenas quando o usuário **não for** um vendedor puro (vendedor sem outros perfis administrativos).

---

## Alteração Necessária

**Arquivo:** `src/pages/vendas/Contratos.tsx`

| Linha | Alteração |
|-------|-----------|
| 65 | Adicionar `isVendedorOnly` à desestruturação do `usePermissions()` |
| 298-301 | Envolver o botão em `{!isVendedorOnly && (...)}` |

### Código Final

**Linha 65 (atualizada):**
```tsx
const { isDiretor, isDesenvolvedor, isAdminMaster, isVendedorOnly } = usePermissions();
```

**Linhas 298-301 (atualizadas):**
```tsx
{!isVendedorOnly && (
  <Button onClick={() => setFormDialogOpen(true)}>
    <Plus className="mr-2 h-4 w-4" />
    Nova Proposta
  </Button>
)}
```

---

## Comportamento Esperado

| Perfil | Visualiza Botão "Nova Proposta" |
|--------|--------------------------------|
| Vendedor CLT (apenas) | Não |
| Vendedor Externo (apenas) | Não |
| Diretor | Sim |
| Gerente Comercial | Sim |
| Supervisor de Vendas | Sim |
| Analista de Cadastro | Sim |
| Desenvolvedor | Sim |
| Admin Master | Sim |

---

## Fluxo do Vendedor

1. Vendedor acessa `/vendas/contratos` (tela de Propostas)
2. Visualiza a lista de propostas (suas ou de todos, conforme permissão)
3. **Não vê** o botão "Nova Proposta"
4. Pode clicar em uma proposta para ver detalhes no drawer
5. Para criar nova proposta, deve acessar Cotações e gerar contrato a partir de uma cotação aceita

---

## Estimativa

| Tarefa | Tempo |
|--------|-------|
| Adicionar `isVendedorOnly` à desestruturação | 1 min |
| Envolver botão em condicional | 1 min |
| Testar com perfil vendedor | 3 min |
| **Total** | **~5 min** |
