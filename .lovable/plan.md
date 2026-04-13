

## Plano: Adicionar variáveis do Indicador no seletor de Templates e Aditivos

### Causa
O grupo "indicador" não existe em `VARIAVEIS_DISPONIVEIS` nem em `DADOS_FICTICIOS`. Por isso as variáveis do associado indicador não aparecem no painel lateral do editor.

### Alterações

**1. `src/components/documentos/VariaveisSelector.tsx`**
- Adicionar import `UserPlus` do lucide-react
- Adicionar `indicador: UserPlus` no `iconesPorGrupo`
- Adicionar grupo `indicador` no `VARIAVEIS_DISPONIVEIS` com: `indicador.nome`, `indicador.cpf`, `indicador.telefone`, `indicador.email`
- Adicionar `indicador: false` no estado `expandido`

**2. `src/components/documentos/templatePreviewData.ts`**
- Adicionar dados fictícios:
  - `indicador.nome` → "Carlos Alberto Pereira"
  - `indicador.cpf` → "987.654.321-00"
  - `indicador.telefone` → "(11) 91234-5678"
  - `indicador.email` → "carlos.pereira@email.com"

### Escopo
- 2 arquivos editados, sem migrations

