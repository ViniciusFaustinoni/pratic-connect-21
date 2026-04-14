

## Plano: Permitir Coordenador de Monitoramento gerir Locais de Instalação

### Problema
A variável `canManagePlataformas` na linha 92 de `Rastreadores.tsx` controla a visibilidade das abas "Plataformas" e "Locais Instalação", mas só inclui `isDiretor || isDesenvolvedor`. O Coordenador de Monitoramento não tem acesso.

### Correção

**Arquivo: `src/pages/monitoramento/Rastreadores.tsx`**

1. Linha 90 — adicionar `isCoordenadorMonitoramento` ao destructuring:
```typescript
const { isDiretor, isDesenvolvedor, isCoordenadorMonitoramento, canManageEquipeEstoque } = usePermissions();
```

2. Linha 92 — incluir na condição:
```typescript
const canManagePlataformas = isDiretor || isDesenvolvedor || isCoordenadorMonitoramento;
```

Isso dará acesso às abas "Plataformas" e "Locais Instalação" para o coordenador de monitoramento, permitindo o CRUD completo (criar, ativar/desativar) que já existe no componente `GerenciarLocaisInstalacao`.

### Nota sobre RLS
O componente `GerenciarLocaisInstalacao` usa `supabase.from('locais_instalacao').insert(...)` e `.update(...)`. As policies RLS dessa tabela precisam permitir INSERT/UPDATE para o role `coordenador_monitoramento`. Se já houver policies permissivas para `authenticated` ou para esse role, nenhuma migration é necessária. Caso contrário, será criada uma migration adicionando as policies adequadas. Verificarei isso durante a implementação.

