

# Ajustar proteção de placa para 48 horas

## Situação atual
A lógica já existe e funciona corretamente — bloqueia outro vendedor e permite o mesmo vendedor. O único problema é o **prazo**: está configurado para **7 dias** quando deveria ser **48 horas**. O modal também não informa quando a placa será liberada.

## Alterações

### 1. `src/hooks/useVerificarPlaca.ts` — Mudar prazo de 7 dias para 48h
- Linha 40-42: trocar `setDate(getDate() - 7)` por `setHours(getHours() - 48)`
- Atualizar comentário

### 2. `src/components/cotacoes/PlacaDuplicadaModal.tsx` — Melhorar informações
- Atualizar texto para mencionar "48 horas"
- Adicionar cálculo e exibição de quando a placa será liberada (`createdAt + 48h`)
- Adicionar fallback para "Vendedor não identificado" (buscar email se nome for null)

### 3. `src/hooks/useVerificarPlaca.ts` — Fallback nome do vendedor
- Se `profiles.nome` for null, buscar email do vendedor via `auth.users` ou exibir "Consultor (ID parcial)"

2 arquivos, ajuste pontual.

