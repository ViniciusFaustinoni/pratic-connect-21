

## Plano: Aplicar menu lateral agrupado (super-grupos) para todos os perfis

### Problema
O layout consolidado do menu lateral com super-grupos (Comercial, Relacionamento, Administrativo) só aparece quando `permissions.isDiretor` é verdadeiro. Outros perfis como coordenador de monitoramento veem o menu antigo com grupos soltos.

### Alteração

**`src/components/layout/AppSidebar.tsx`**

1. Renomear `directorSuperGroups` para `superGroups` e remover a condição `if (!permissions.isDiretor) return []` no `useMemo` (linha 709) — construir super-grupos para todos os usuários baseado nos `visibleGroups` já filtrados por permissão

2. Remover todas as condições `permissions.isDiretor` que gatilham o uso de super-grupos:
   - Linha 657: estado inicial de `openSuperGroups` — remover check `isDiretor`
   - Linha 686: auto-open no `useEffect` — remover check `isDiretor`
   - Linha 761: modo colapsado — trocar `permissions.isDiretor && directorSuperGroups` por `superGroups`
   - Linha 948: modo expandido — mesma troca

3. Se o usuário tiver acesso a módulos de apenas um super-grupo, exibir os sub-grupos diretamente sem o nível de super-grupo (para não ter um collapsible desnecessário com um único item)

### Lógica
- Os `visibleGroups` já são filtrados por permissão do usuário
- Os super-grupos simplesmente agrupam esses grupos visíveis em categorias
- Não muda nenhuma permissão, apenas a organização visual

### Resultado
- Coordenador de monitoramento vê: Dashboard + Comercial (com Monitoramento dentro)
- Diretor vê: Dashboard + Comercial + Relacionamento + Administrativo (como hoje)
- Qualquer perfil com acesso a múltiplos módulos vê o menu organizado em super-grupos

### Arquivo
- `src/components/layout/AppSidebar.tsx`

