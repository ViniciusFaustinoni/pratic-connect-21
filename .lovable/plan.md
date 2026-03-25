

# Restringir Exclusao de Planos e Beneficios ao Diretor

## Problema
Qualquer usuario com acesso a pagina de Gestao Comercial ou Gestao de Planos consegue excluir planos e beneficios. Apenas diretores (e super admins) devem ter essa permissao.

## Solucao
Adicionar verificacao `isDiretor || isSuperAdmin` nos componentes que exibem botoes de exclusao. Botoes ficam desabilitados com tooltip explicativo para quem nao tem permissao (seguindo a politica de feedback visual ja existente no projeto).

## Alteracoes

### 1. `src/components/gestao-comercial/ProdutosPlanos.tsx`
- Importar `usePermissions`
- Extrair `isDiretor` e `isDesenvolvedor`/`isAdminMaster`
- No dropdown de acoes do plano: desabilitar "Excluir" com tooltip "Apenas diretores podem excluir planos" quando o usuario nao for diretor/super admin
- Manter a logica existente de "Inative antes de excluir" para planos ativos

### 2. `src/components/gestao-comercial/BeneficiosCoberturas.tsx`
- Importar `usePermissions`
- Desabilitar botao de excluir beneficio/cobertura com tooltip para usuarios sem permissao

### 3. `src/components/admin/planos/PlanosTab.tsx`
- Importar `usePermissions`
- No `PlanCard`, passar prop `canDelete` baseada em `isDiretor || isSuperAdmin`
- Desabilitar botao de excluir no card quando `canDelete` for false

### 4. `src/components/admin/planos/PlanCard.tsx`
- Aceitar prop opcional `canDelete?: boolean` (default true para retrocompatibilidade)
- Quando `canDelete` for false, renderizar botao Trash2 desabilitado com Tooltip

### 5. `src/components/admin/planos/BeneficiosTab.tsx`
- Importar `usePermissions`
- Desabilitar botao de excluir beneficio com tooltip quando usuario nao for diretor

## Arquivos

| Arquivo | Tipo |
|---|---|
| `src/components/gestao-comercial/ProdutosPlanos.tsx` | Editado |
| `src/components/gestao-comercial/BeneficiosCoberturas.tsx` | Editado |
| `src/components/admin/planos/PlanosTab.tsx` | Editado |
| `src/components/admin/planos/PlanCard.tsx` | Editado |
| `src/components/admin/planos/BeneficiosTab.tsx` | Editado |

