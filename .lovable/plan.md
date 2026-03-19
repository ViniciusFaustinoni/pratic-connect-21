

# Corrigir fluxo de Migração no "Outras Entradas"

## Resumo

Substituir a busca por leads no fluxo de Migração por um campo de entrada de CPF com validação automática (vínculo ativo e débitos), e ao confirmar, abrir o `MigracaoDiretaDialog` com CPF pré-preenchido/bloqueado e consultor logado auto-selecionado.

## Alterações

### 1. `src/components/vendas/OutrasEntradasMenu.tsx`

- Remover a query de busca de leads (`leadResults`) e toda a UI de resultados de leads
- Quando `selectedTipo === 'migracao'`, renderizar no lugar do campo de busca genérico:
  - Título: "CPF do cliente"
  - Instrução: "Digite o CPF do cliente para verificar se ele pode ser migrado."
  - Input com máscara de CPF (usar `maskCPF` de validations)
  - Ao atingir 11 dígitos (14 chars com máscara), disparar verificação automática
- Verificação (queries inline com `useQuery`):
  - Buscar em `associados` por CPF: se encontrar com `status = 'ativo'` → alerta "Cliente já é associado ativo. Não é possível iniciar migração." + botão desabilitado
  - Se encontrar com débitos (usar `useVerificarDebitosAssociado` pelo id encontrado) → alerta "Há débitos pendentes que precisam ser quitados antes de qualquer nova filiação."
  - Se não encontrar ou encontrar apenas cancelado sem débitos → badge verde "Cliente elegível para migração" + botão "Iniciar Migração" habilitado
- Ao clicar "Iniciar Migração": fechar popover, abrir `MigracaoDiretaDialog` passando `cpfPreenchido` e `consultorIdPreenchido`
- Remover `useBuscaPlaca` e `useAssociadoSearch` do fluxo de migração (já está assim)

### 2. `src/components/cadastro/MigracaoDiretaDialog.tsx`

- Adicionar props opcionais à interface `Props`:
  - `cpfInicial?: string` — pré-preenche e bloqueia o campo CPF (`disabled` ou `readOnly`)
  - `consultorIdInicial?: string` — pré-seleciona o consultor no dropdown
- No `useEffect` de abertura ou no `useState` inicial, setar `cpf` e `consultorId` a partir das props quando fornecidos
- Campo CPF: se `cpfInicial` fornecido, renderizar com `readOnly` e estilo visual de campo bloqueado

### 3. Limpeza

- Remover `handleSelectLead` do OutrasEntradasMenu
- Remover referências a `leadResults`, `loadingLeads` e a query de leads

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/vendas/OutrasEntradasMenu.tsx` | Substituir busca de leads por input CPF + verificação |
| `src/components/cadastro/MigracaoDiretaDialog.tsx` | Adicionar props `cpfInicial` e `consultorIdInicial` |

