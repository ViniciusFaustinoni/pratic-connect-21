

## Plano: Permitir atribuir coberturas existentes nao vinculadas no modal do plano

### Problema
O botao "Nova Cobertura" no modal de edicao do plano so permite criar uma cobertura do zero. Nao ha opcao de selecionar e vincular uma cobertura ja existente no catalogo que ainda nao esteja atribuida a nenhum plano.

### Alteracoes

**`src/components/admin/planos/PlanCoberturasList.tsx`**

1. Adicionar botao "Atribuir Existente" ao lado de "Nova Cobertura"
2. Ao clicar, abrir um dialog que:
   - Busca todas as coberturas da tabela `coberturas` que NAO possuem vinculo em `planos_coberturas` (subquery ou left join)
   - Exibe lista filtrada com campo de busca por nome
   - Permite selecionar uma ou mais coberturas
   - Ao confirmar, insere os registros em `planos_coberturas` vinculando ao plano atual
3. Query para coberturas disponiveis:
```sql
SELECT c.* FROM coberturas c
WHERE c.ativo = true
AND c.id NOT IN (SELECT cobertura_id FROM planos_coberturas)
ORDER BY c.nome
```

**Estrutura do dialog (inline no componente):**
- State `assignOpen` para controlar visibilidade
- State `search` para filtro de texto
- Query `useQuery` com key `['coberturas-disponiveis']` que busca coberturas sem vinculo
- Lista com checkboxes para selecao multipla
- Botao "Vincular Selecionadas" que faz batch insert em `planos_coberturas`
- Invalida queries apos vinculacao

### Resultado
- Gestor pode criar cobertura nova OU atribuir cobertura existente do catalogo
- Apenas coberturas nao vinculadas a nenhum plano aparecem como opcao (consistente com a regra de itens unicos por plano)
- Fluxo rapido sem sair do modal de edicao

### Arquivo
- `src/components/admin/planos/PlanCoberturasList.tsx`

