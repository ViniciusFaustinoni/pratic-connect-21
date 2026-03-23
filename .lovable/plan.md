

# Permitir múltiplos níveis com o mesmo perfil na Grade de Comissão

## Problema

Hoje a grade impede que o mesmo perfil (ex: `vendedor_externo`) apareça mais de uma vez. Isso bloqueia cenários reais como:

```text
Nível 1: Vendedor Externo (quem vendeu)     → 40%
Nível 2: Vendedor Externo (indicador)        → 10%
Nível 3: Agência                             → 5%
```

A trava está em dois pontos do `GradeComissaoForm.tsx`:
1. **Linha 88-90** — Validação no `handleSave` que rejeita roles duplicados
2. **Linha 231** — `disabled` no `SelectItem` que impede selecionar um role já usado

## Solução

Remover ambas as travas. O identificador único de cada nível passa a ser o **nome**, não o perfil. A validação de nomes duplicados já pode ser adicionada no lugar.

## Arquivo

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/configuracoes/GradeComissaoForm.tsx` | Remover validação de role duplicado (linhas 88-90) e remover `disabled` no SelectItem (linha 231) |

## Detalhe

- Remover o bloco `const rolesUsed = ... if (hasDuplicates) return toast.error(...)` do `handleSave`
- Remover `disabled={niveis.some((n, i) => i !== idx && n.role === r.role)}` do `SelectItem`
- Adicionar validação de nomes duplicados no lugar: se dois níveis tiverem o mesmo nome, exibir erro

