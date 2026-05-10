# Super-grupo "Em Breve" na sidebar (apenas diretores)

## Contexto

Diretores hoje veem 3 super-grupos colapsáveis na sidebar (`SUPER_GROUPS` em `AppSidebar.tsx`): **Comercial**, **Relacionamento** e **Administrativo**, cada um agregando módulos por `moduleIds`.

Vamos adicionar um quarto super-grupo, **Em Breve**, contendo módulos que ainda estão em desenvolvimento, mantendo a navegação funcionando normalmente (apenas reorganização visual).

## O que será feito

1. **Novo super-grupo `em_breve`** em `SUPER_GROUPS` (`src/components/layout/AppSidebar.tsx`):
   - `label`: "Em Breve"
   - `icon`: `Clock` (já importado) ou `Rocket`
   - `color`: tom neutro/cinza para indicar status "em construção" (ex.: `#94a3b8`)
   - `moduleIds`: `['eventos', 'assistencia', 'oficinas', 'financeiro', 'comissoes', 'contabilidade', 'juridico', 'rh', 'marketing', 'relatorios']`

2. **Remover esses 10 IDs** dos super-grupos existentes:
   - `relacionamento` perde: `eventos`, `assistencia`, `oficinas` → fica com `relacionamento`, `monitoramento`, `cobranca`
   - `administrativo` perde: `financeiro`, `comissoes`, `contabilidade`, `juridico`, `rh`, `marketing`, `relatorios` → fica com `diretoria`, `documentos`

3. **Sem alterações** em:
   - `menuConfig.groups` (definições e permissões dos módulos permanecem intactas)
   - Lógica de renderização (o sistema de super-grupos já existe e renderiza qualquer entrada nova automaticamente)
   - Comportamento para perfis não-diretores (super-grupos só se aplicam a diretores)
   - Navegação dos itens (links continuam clicáveis, sem desabilitar)

## Detalhes técnicos

- Arquivo único alterado: `src/components/layout/AppSidebar.tsx` (constante `SUPER_GROUPS`, ~linhas 463–485).
- Cor sugerida `#94a3b8` (slate-400) para diferenciar visualmente do conteúdo "ativo".
- O grupo herda automaticamente o comportamento colapsável dos demais super-grupos.

## Fora do escopo

- Não vamos criar um sistema de flag `comingSoon` por módulo nem desabilitar links.
- Não vamos mexer em permissões (`canManageX`) — quem já não enxergava o módulo continua sem enxergar.
