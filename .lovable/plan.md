
# Corrigir visibilidade para usuarios com multiplos perfis

## Problema

Quando um usuario tem `coordenador_monitoramento` + `instalador_vistoriador`, o sistema trata como "apenas instalador" e redireciona forcadamente para `/instalador`, impedindo acesso ao painel de coordenador.

A causa esta em `usePermissions.ts`: a flag `isInstaladorVistoriadorOnly` so exclui diretor, gerencia, desenvolvedor e admin_master da condicao "Only". Nao considera outros perfis operacionais como `coordenador_monitoramento`.

## Solucao

Alterar as flags "Only" para excluir mutuamente todos os perfis operacionais relevantes, nao apenas os de gerencia/admin.

## Alteracoes

### `src/hooks/usePermissions.ts`

1. **`isInstaladorVistoriadorOnly` (linha 134)**: Adicionar exclusao de `coordenador_monitoramento`, `analista_plataforma`, `analista_cadastro`, `analista_eventos`, `regulador`, `sindicante` — ou seja, se tem qualquer outro perfil alem de instalador, NAO e "only".

2. **`isCoordenadorMonitoramentoOnly` (linha 126)**: Adicionar exclusao de `instalador_vistoriador` e outros perfis operacionais.

3. **Mesma logica para os demais "Only"**: `isAnalistaEventosOnly`, `isReguladorOnly`, `isSindicanteOnly` — cada um deve excluir os outros perfis operacionais.

### `src/hooks/useRouteGuard.ts`

4. **Adicionar tratamento para perfis mistos**: Quando um usuario tem perfis que incluem tanto layouts especiais (instalador, regulador, sindicante) quanto perfis do sistema principal (coordenador, analista), ele deve acessar o **sistema principal** (nao ser forcado ao app mobile). O guard dinamico baseado em `visibleModules` ja cobre isso — basta que as flags "Only" estejam corretas.

## Resumo tecnico

| Arquivo | Alteracao |
|---|---|
| `src/hooks/usePermissions.ts` | Expandir exclusoes nas flags "Only" para considerar todos os perfis operacionais |
| `src/hooks/useRouteGuard.ts` | Nenhuma alteracao necessaria (depende das flags corrigidas) |

## Resultado esperado

Um usuario com `coordenador_monitoramento` + `instalador_vistoriador`:
- `isInstaladorVistoriadorOnly` = false
- `isCoordenadorMonitoramentoOnly` = false
- Nao sofre redirect forcado para `/instalador`
- Acessa o sistema principal com os modulos visiveis definidos pela uniao dos dois perfis na tabela `role_module_visibility`
