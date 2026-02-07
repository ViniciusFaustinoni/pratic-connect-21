
# Plano: Remover Cards de Documentos Pendentes e Ajustar Instalações Hoje

## Problema Identificado

Na Dashboard existem dois cards que precisam ser ajustados:

1. **Documentos Pendentes** - Não deve aparecer para NENHUM usuário
2. **Instalações Hoje** - Deve aparecer APENAS para:
   - Coordenador de Monitoramento (vê todas as instalações)
   - Vistoriadores/Instaladores (vêem apenas as suas)

---

## Alterações Necessárias

### Arquivo: `src/pages/Dashboard.tsx`

#### 1. Remover Card "Documentos Pendentes"

Remover completamente o bloco de código das linhas 530-577 que renderiza o card de "Documentos Pendentes".

#### 2. Restringir Card "Instalações Hoje"

Alterar a condição de exibição do card de instalações (linhas 579-638):

**Condição Atual:**
```typescript
{!isVendedorOnly && (
  // Card de Instalações Hoje
)}
```

**Nova Condição:**
```typescript
{(isCoordenadorMonitoramento || isInstaladorVistoriador || isVistoriadorBase) && (
  // Card de Instalações Hoje
)}
```

Para isso, será necessário:
1. Importar as permissões adicionais do hook `usePermissions()`
2. Usar as variáveis `isCoordenadorMonitoramento`, `isInstaladorVistoriador` e `isVistoriadorBase`

---

## Resultado Esperado

| Card | Usuário | Visibilidade |
|------|---------|--------------|
| Documentos Pendentes | Qualquer | Oculto |
| Instalações Hoje | Coordenador Monitoramento | Visível (todas) |
| Instalações Hoje | Instalador/Vistoriador | Visível (suas tarefas) |
| Instalações Hoje | Outros perfis | Oculto |

---

## Seção Técnica

### Código a Adicionar (Desestruturação)

Na linha onde o `usePermissions()` é chamado no Dashboard, adicionar:

```typescript
const { 
  // ... permissões existentes ...
  isCoordenadorMonitoramento,
  isInstaladorVistoriador,
  isVistoriadorBase
} = usePermissions();
```

### Condição Final do Card Instalações

```typescript
{(isCoordenadorMonitoramento || isInstaladorVistoriador || isVistoriadorBase) && (
  <Card className="border-border bg-card">
    {/* ... conteúdo do card ... */}
  </Card>
)}
```

### Observação sobre Filtragem de Dados

O hook que busca as instalações do dia já deve filtrar os dados de acordo com o perfil do usuário logado:
- Coordenador: vê todas
- Vistoriador/Instalador: vê apenas as atribuídas a ele

Isso deve ser verificado no hook `useInstalacoesHoje` ou similar para garantir que os dados exibidos estejam corretos para cada perfil.
