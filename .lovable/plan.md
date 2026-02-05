
# Plano: Ajustes no Dashboard para Vendedor

## Resumo das Alterações Solicitadas

O Vendedor (perfil `vendedor_clt` ou `vendedor_externo`) deve ter uma visão simplificada do Dashboard, removendo elementos que não são relevantes para sua função.

---

## Alterações Necessárias

### 1. Adicionar verificação `isVendedorOnly` no Dashboard

**Arquivo:** `src/pages/Dashboard.tsx`

Criar uma flag `isVendedorOnly` similar às outras flags `*Only`:

```typescript
const isVendedorOnly = (hasRole('vendedor_clt') || hasRole('vendedor_externo')) &&
  !isDiretor &&
  !isGerencia &&
  !isDesenvolvedor &&
  !isAdminMaster &&
  !isAnalistaCadastroOnly &&
  !isCoordenadorMonitoramentoOnly;
```

---

### 2. Ocultar KPI Card "Instalações/Mês"

**Linhas ~495-500**

Envolver o card de "Instalações/Mês" em condicional:

```tsx
{!isVendedorOnly && (
  <KPICard
    titulo="Instalações/Mês"
    valor={instMetricas?.concluidasHoje || 0}
    emoji="🔧"
    loading={instalacoesLoading}
  />
)}
```

---

### 3. Ajustar KPI Card "Receita Mensal"

**Linhas ~501-506**

Para vendedor, mostrar apenas o somatório de taxas de adesão de propostas concluídas pelo próprio vendedor:

```tsx
<KPICard
  titulo="Receita Mensal"
  valor={`R$ ${(
    isVendedorOnly 
      ? // Soma das taxas de adesão de propostas concluídas pelo vendedor
        contratos?.filter(c => c.status === 'ativo' && c.vendedor_id === user?.id)
          .reduce((acc, c) => acc + (c.valor_adesao || 0), 0) || 0
      : // Para outros perfis: soma do valor mensal de todos os contratos ativos
        contratos?.filter(c => c.status === 'ativo')
          .reduce((acc, c) => acc + (c.valor_mensal || 0), 0) || 0
  ).toLocaleString('pt-BR')}`}
  emoji="💰"
  loading={contratosLoading}
/>
```

> **Nota:** Precisarei verificar se o hook `useContratos` já retorna o campo `vendedor_id` e `valor_adesao`. Caso contrário, será necessário ajustar a query ou criar uma query específica para vendedores.

---

### 4. Ocultar Card "Ações Rápidas"

**Linhas ~606-616**

Envolver em condicional:

```tsx
{!isVendedorOnly && (
  <Card className="border-border bg-card">
    <CardHeader>
      <CardTitle className="text-lg text-foreground">Ações Rápidas</CardTitle>
    </CardHeader>
    <CardContent>
      <QuickActions />
    </CardContent>
  </Card>
)}
```

---

### 5. Ocultar Card "Documentos Pendentes"

**Linhas ~621-666**

Envolver em condicional:

```tsx
{!isVendedorOnly && (
  <Card className="border-border bg-card">
    ...Documentos Pendentes...
  </Card>
)}
```

---

### 6. Ocultar Card "Instalações Hoje"

**Linhas ~668-725**

Envolver em condicional:

```tsx
{!isVendedorOnly && (
  <Card className="border-border bg-card">
    ...Instalações Hoje...
  </Card>
)}
```

---

### 7. (Opcional) Atualizar Hook usePermissions

**Arquivo:** `src/hooks/usePermissions.ts`

Adicionar `isVendedorOnly` ao retorno do hook para reutilização em outros componentes:

```typescript
// Verifica se é APENAS vendedor (sem perfis de gerência ou admin)
const isVendedorOnly = isVendedor() && 
  !isDiretor && 
  !isGerencia() && 
  !isDesenvolvedor && 
  !isAdminMaster &&
  !isAnalistaCadastro;
```

E adicionar ao objeto `permissions`:
```typescript
isVendedorOnly,
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/usePermissions.ts` | Adicionar flag `isVendedorOnly` |
| `src/pages/Dashboard.tsx` | Ocultar cards conforme perfil vendedor |

---

## Verificação Necessária

Antes de implementar a lógica de "Receita Mensal" para vendedor, preciso verificar:
1. Se o hook `useContratos` retorna `vendedor_id`
2. Se existe campo `valor_adesao` nos contratos
3. Se a filtragem por vendedor logado é viável com os dados atuais

---

## Resultado Esperado

**Dashboard do Vendedor terá:**
- KPIs: Associados Ativos, Leads do Mês, Receita Mensal (apenas suas adesões)
- Funil de Vendas (leads)
- Últimos Leads
- Widget de Follow-ups

**Dashboard do Vendedor NÃO terá:**
- Card "Instalações/Mês"
- Card "Ações Rápidas"
- Card "Documentos Pendentes"
- Card "Instalações Hoje"

---

## Estimativa

| Tarefa | Tempo |
|--------|-------|
| Adicionar `isVendedorOnly` ao usePermissions | 3 min |
| Ajustar KPIs no Dashboard | 5 min |
| Ocultar cards condicionalmente | 5 min |
| Testar com perfil vendedor | 5 min |
| **Total** | **~18 min** |
