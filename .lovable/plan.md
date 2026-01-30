

# Plano: Remover Área de Credenciais do Menu Monitoramento

## Contexto

A página **Credenciais de Rastreadores** (`/monitoramento/credenciais`) é uma duplicação de funcionalidade que já existe em **Configurações > Integrações**. 

Na área de Integrações, os usuários podem:
- Configurar credenciais do SGA Hinova
- Configurar credenciais do Softruck
- Configurar credenciais da Rede Veículos
- Testar conexões
- E mais integrações

Manter duas áreas distintas para a mesma funcionalidade causa confusão e dificulta a manutenção.

---

## O Que Será Removido

| Item | Localização | Ação |
|------|-------------|------|
| Submenu "Credenciais API" | Menu Monitoramento | Remover |
| Rota `/monitoramento/credenciais` | App.tsx | Remover |
| Breadcrumb `/monitoramento/credenciais` | GlobalBreadcrumb.tsx | Remover |
| Arquivo `ConfigCredenciais.tsx` | src/pages/monitoramento/ | Deletar |

---

## Alterações por Arquivo

### 1. `src/components/layout/AppSidebar.tsx`

Remover o item do submenu Monitoramento:

```typescript
// REMOVER estas linhas (194-199):
{ 
  title: 'Credenciais API', 
  url: '/monitoramento/credenciais', 
  icon: Key,
  permission: 'isGerencia',
},
```

### 2. `src/App.tsx`

Remover:
- O import do componente `ConfigCredenciais`
- A rota `/monitoramento/credenciais`

### 3. `src/components/layout/GlobalBreadcrumb.tsx`

Remover a entrada do breadcrumb:

```typescript
// REMOVER linha 108:
'/monitoramento/credenciais': { label: 'Credenciais' },
```

### 4. `src/pages/monitoramento/ConfigCredenciais.tsx`

Deletar o arquivo completamente, pois não será mais utilizado.

---

## Onde Configurar Credenciais Após Remoção

Os usuários devem usar:

**Configurações > Integrações > Aba Serviços**

Lá encontrarão cards para:
- SGA Hinova
- Softruck  
- Rede Veículos
- ASAAS
- Autentique
- E-mail (Resend)

Cada card possui botão "Configurar" que abre um formulário para inserir credenciais, testar conexão e salvar.

---

## Arquivos a Deletar

| Arquivo | Motivo |
|---------|--------|
| `src/pages/monitoramento/ConfigCredenciais.tsx` | Funcionalidade duplicada |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/layout/AppSidebar.tsx` | Remover item "Credenciais API" do menu |
| `src/App.tsx` | Remover import e rota |
| `src/components/layout/GlobalBreadcrumb.tsx` | Remover entrada do breadcrumb |

---

## Impacto

- Usuários que acessavam `/monitoramento/credenciais` verão erro 404
- Devem acessar `/configuracoes/integracoes` para mesma funcionalidade
- Não há perda de funcionalidade, apenas consolidação

---

## Tempo Estimado

| Tarefa | Tempo |
|--------|-------|
| Modificar 3 arquivos | 5 min |
| Deletar 1 arquivo | 1 min |
| **Total** | **~6 min** |

