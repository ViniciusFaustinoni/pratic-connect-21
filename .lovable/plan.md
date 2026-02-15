
# Adicionar opcao "Ver Sinistro" quando chamado ja tem sinistro vinculado

## Contexto

Quando um chamado de assistencia foi criado a partir de um sinistro, o menu de acoes ainda mostra "Abrir Sinistro" (que cria um novo). O correto seria mostrar "Ver Sinistro" e navegar para o sinistro existente.

## Como funciona hoje

- A tabela `sinistros` possui os campos `chamado_assistencia_id` e `chamado_origem_id` que vinculam um sinistro a um chamado
- O menu de acoes sempre mostra "Abrir Sinistro" com link para criar um novo, independente de ja existir um vinculado

## Solucao

Arquivo: `src/pages/assistencia/ChamadoDetalhe.tsx`

1. **Nova query**: Buscar na tabela `sinistros` se existe algum registro com `chamado_assistencia_id` ou `chamado_origem_id` igual ao ID do chamado atual
2. **Condicional no menu**: 
   - Se existir sinistro vinculado: mostrar "Ver Sinistro" com icone e navegar para `/eventos/sinistros/{sinistro_id}`
   - Se nao existir: manter o comportamento atual de "Abrir Sinistro" (criacao)

### Detalhes tecnicos

Nova query no componente `ChamadoDetalhe`:

```typescript
const { data: sinistroVinculado } = useQuery({
  queryKey: ['chamado-sinistro', id],
  queryFn: async () => {
    const { data } = await supabase
      .from('sinistros')
      .select('id, protocolo')
      .or(`chamado_assistencia_id.eq.${id},chamado_origem_id.eq.${id}`)
      .limit(1)
      .maybeSingle();
    return data;
  },
  enabled: !!id,
});
```

No menu de acoes (linhas 258-264), substituir o item fixo por condicional:

- Com sinistro: "Ver Sinistro (PROT-XXXXX)" navegando para a pagina do sinistro
- Sem sinistro: "Abrir Sinistro" criando novo (comportamento atual)
