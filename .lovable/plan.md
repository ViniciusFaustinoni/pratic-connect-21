

## Plano: Corrigir variavel do consultor no template AF1

### Problema
O template AF1 no banco de dados tem uma célula "Consultor:" com conteúdo vazio (`<p><br></p>`) em vez de usar a variável `{{consultor.nome}}`. Como o sistema de substituição de variáveis só troca `{{...}}` por valores reais, essa célula fica sempre em branco.

### Trecho atual no template (posição ~7232)
```html
<tr>
  <td><p><strong>Consultor:</strong></p></td>
  <td><p><br></p></td>  <!-- ← vazio, sem variável -->
</tr>
```

### Solução
Duas correções complementares:

**1. Atualizar o template AF1 no banco** (migration SQL)
- Substituir o `<p><br></p>` na célula do Consultor por `<p>{{consultor.nome}}</p>`
- Isso garante que a variável seja processada pelo `substituirVariaveis`

**2. Fallback no código** (`supabase/functions/_shared/template-utils.ts`)
- Na função `substituirVariaveis`, após substituir todas as variáveis, fazer um replace adicional para garantir que qualquer célula "Consultor:" seguida de célula vazia receba o valor do consultor
- Isso protege contra templates futuros que esqueçam a variável

### Escopo
- 1 migration SQL (replace no conteúdo do template AF1)
- 1 arquivo de código (template-utils.ts) — fallback opcional
- Redeploy das Edge Functions que importam template-utils

