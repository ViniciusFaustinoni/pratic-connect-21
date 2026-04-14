

## Plano: Permitir coordenador de monitoramento gerir Locais de Instalacao

### Problema
A aba "Locais Instalacao" na pagina de Rastreadores so aparece para diretores e desenvolvedores (`canManagePlataformas = isDiretor || isDesenvolvedor`). O coordenador de monitoramento nao ve essa aba.

### Correcao

**Arquivo: `src/pages/monitoramento/Rastreadores.tsx`**

Linha 90-92: Adicionar `isCoordenadorMonitoramento` ao destructuring do `usePermissions()` e incluir na condicao:

```typescript
const { isDiretor, isDesenvolvedor, isCoordenadorMonitoramento, canManageEquipeEstoque } = usePermissions();

const canManagePlataformas = isDiretor || isDesenvolvedor || isCoordenadorMonitoramento;
```

Isso fara as abas "Plataformas" e "Locais Instalacao" aparecerem para o coordenador de monitoramento. Se apenas "Locais Instalacao" deve ser visivel (sem "Plataformas"), sera necessario separar as permissoes em duas variaveis distintas.

