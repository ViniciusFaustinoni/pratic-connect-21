

## Diagnóstico

Usuário relatou que associados com **isenção marcada** estão sumindo das listagens. Preciso investigar:

1. Onde está o campo de isenção (provavelmente `isento`, `isencao`, ou similar em `associados`)
2. Quais queries/filtros estão excluindo esses registros
3. Se há filtro de status que ignora isentos

Vou explorar antes de propor solução.
