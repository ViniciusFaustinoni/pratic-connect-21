

## Deletar registros de elegibilidade da linha Especial Plus

### Situação atual
- **157 registros** encontrados na tabela `plano_elegibilidade_modelos` para o `plano_id = '12cdd378-b42b-4389-a28f-1eba1fe7c837'` (Especial Plus)

### Ação
Executar o seguinte comando SQL via ferramenta de escrita no banco:

```sql
DELETE FROM plano_elegibilidade_modelos 
WHERE plano_id = '12cdd378-b42b-4389-a28f-1eba1fe7c837';
```

Isso remove os 157 registros, zerando a lista de elegibilidade da linha Especial Plus para que a importação correta possa ser feita em seguida.

### O que NÃO muda
- Nenhuma outra linha/plano é afetada
- Nenhum código alterado
- Nenhuma estrutura de tabela modificada

