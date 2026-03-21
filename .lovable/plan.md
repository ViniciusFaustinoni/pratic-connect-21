

# Plano: Exibir percentual da empresa nas grades de comissão

## Conceito

O valor que "sobra" da soma dos níveis de uma grade (100% - total alocado) pertence à empresa. Isso precisa ser visualmente explícito tanto no formulário de criação/edição quanto na listagem de grades.

## Alterações

### 1. `GradeComissaoForm.tsx` -- Formulário

Na seção "Total alocado" (linhas 238-259), adicionar abaixo da barra de progresso:

- Linha informativa: **"Percentual da empresa: XX%"** (100 - totalPercentual), com ícone de prédio (`Building2`) e cor verde/neutra
- Tooltip/FieldHint: "Este é o percentual que permanece na empresa. Corresponde à diferença entre 100% e o total distribuído nos níveis."
- Se total = 100%, exibir "0% — Todo o valor é distribuído entre os níveis"
- Se total = 0%, exibir "100% — Nenhum nível configurado"

### 2. `GradesComissao.tsx` -- Listagem

Na área de cada card (linhas 161-165), ao lado de "Total: XX%", adicionar:

- **"Empresa: YY%"** (100 - total), com badge ou texto em cor diferenciada
- Tooltip: "Percentual retido pela empresa"

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/configuracoes/GradeComissaoForm.tsx` | Exibir "Percentual da empresa" no resumo |
| `src/pages/configuracoes/GradesComissao.tsx` | Exibir "Empresa: XX%" em cada card |

