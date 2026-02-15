
# Corrigir listagem de prestadores no modal de atribuicao

## Problema

O modal "Atribuir Prestador" nao mostra nenhum prestador porque ha uma incompatibilidade nos valores de tipo de servico:

- Os chamados sao criados com `tipo_servico: 'guincho'` (pelo sistema de sinistros, IA e webhook WhatsApp)
- Porem os prestadores cadastrados possuem `tipos_servico: ['reboque']`
- A query filtra com `.contains('tipos_servico', ['guincho'])`, que nao encontra match com `['reboque']`

O label no proprio codigo ja reconhece que sao o mesmo servico: `reboque: 'Reboque/Guincho'`.

## Solucao

Arquivo: `src/components/assistencia/AtribuirPrestadorModal.tsx`

1. Criar um mapa de aliases para tipos de servico equivalentes (ex: `guincho` e `reboque` sao o mesmo)
2. Na query de busca, expandir o filtro para incluir todos os aliases do tipo de servico do chamado
3. Ao inves de usar `.contains()` com um unico valor, usar `.overlaps()` com a lista expandida de tipos equivalentes

### Mapa de equivalencias

```
guincho <-> reboque
```

### Mudanca na query

Antes:
```
.contains('tipos_servico', [chamado.tipo_servico])
```

Depois:
```
.overlaps('tipos_servico', ['guincho', 'reboque'])  // quando tipo_servico eh 'guincho' ou 'reboque'
```

## Detalhes tecnicos

- Adicionar constante `TIPOS_EQUIVALENTES` mapeando aliases bidirecionalmente
- Criar funcao `expandirTipoServico(tipo)` que retorna array com o tipo original + equivalentes
- Substituir `.contains()` por `.overlaps()` usando o array expandido
- Isso garante que um chamado do tipo "guincho" encontre prestadores cadastrados com "reboque" e vice-versa
