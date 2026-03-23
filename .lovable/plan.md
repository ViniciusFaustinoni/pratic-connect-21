

# Plano: Grade Obrigatória para Vendedor Externo e Agência

## O que muda

### `src/pages/configuracoes/UsuarioForm.tsx`

**Validação antes de salvar** — No `handleSave` / `mutationFn` (linha ~408), antes de prosseguir com update ou create:

```text
Se perfis incluem 'vendedor_externo' OU 'agencia':
  Se grade_comissao_id está vazio → bloquear save
```

- Exibir `toast.error('Selecione uma grade de comissão')` 
- Setar erro visual no campo grade (borda vermelha no `SelectTrigger`)
- Não aplicar para `vendedor_clt` — apenas `vendedor_externo` e `agencia`

**Destaque visual do campo** — No bloco do Select de grade (linha ~727):
- Adicionar estado `gradeError` que fica `true` quando validação falha
- Aplicar classe `border-destructive` no `SelectTrigger` quando em erro
- Limpar erro quando usuário seleciona uma grade

### Lógica específica

A validação se aplica tanto na **edição** (linha 409) quanto na **criação** (linha 449). Em ambos os caminhos, checar antes de qualquer operação no banco.

## Arquivo afetado

| Arquivo | Alteração |
|---|---|
| `src/pages/configuracoes/UsuarioForm.tsx` | Validação obrigatória de grade para `vendedor_externo` e `agencia` + destaque visual |

