

## Plano: Duplicar plano com desconto e sufixo

### Contexto
A funcao `useDuplicatePlan` ja clona coberturas, beneficios, regras de elegibilidade e exclusoes. Falta a possibilidade de aplicar desconto percentual nos valores e sufixo nos nomes ao duplicar.

### Alteracoes

**1. Novo componente `DuplicarPlanoModal`** (`src/components/admin/planos/DuplicarPlanoModal.tsx`)
- Modal com campos:
  - **Desconto (%)**: input numerico (0-100), default 0
  - **Sufixo**: input texto (ex: "- SP"), default vazio
- Botao "Duplicar" que chama a mutation com os parametros
- Preview do nome resultante: `{nomeOriginal} (cópia){sufixo}`

**2. Atualizar `useDuplicatePlan`** (`src/hooks/usePlansAdmin.ts`)
- Mudar assinatura para receber `{ id, desconto?, sufixo? }`
- No nome do plano: `nome (cópia){sufixo}`
- Ao clonar cada **cobertura**: aplicar sufixo no `nome`, aplicar desconto em `valor`, `valor_limite`, `franquia_valor` (multiplicar por `(100 - desconto) / 100`, arredondar 2 casas)
- Ao clonar cada **beneficio**: aplicar sufixo no `name`, aplicar desconto em `preco_sugerido`
- Valores nulos permanecem nulos

**3. Atualizar chamadas em `LinhasPlanos.tsx` e `ProdutosPlanos.tsx`**
- Em vez de `duplicatePlan.mutate(plano.id)`, abrir o `DuplicarPlanoModal` passando o plano
- O modal chama `duplicatePlan.mutateAsync({ id, desconto, sufixo })`

### Resultado
- Ao clicar em "Duplicar", abre modal com opcoes de desconto e sufixo
- Desconto 0% e sufixo vazio = comportamento identico ao atual
- Desconto e sufixo aplicados automaticamente em todas as coberturas e beneficios clonados
- Cada item clonado continua independente para edicao posterior

### Arquivos
- `src/components/admin/planos/DuplicarPlanoModal.tsx` (novo)
- `src/hooks/usePlansAdmin.ts`
- `src/components/gestao-comercial/LinhasPlanos.tsx`
- `src/components/gestao-comercial/ProdutosPlanos.tsx`

