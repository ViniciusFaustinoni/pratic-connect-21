

# Erro 404 ao clicar no nome do associado na Fila de Vistorias

## Diagnostico

Na `FilaVistorias.tsx` (linha 722-723), o link do cliente para vistorias de evento aponta para:
```
/sinistros/${vistoria.sinistroId}
```

Porem a rota correta no sistema e:
```
/eventos/sinistros/${vistoria.sinistroId}
```

## Correcao

| Arquivo | Alteracao |
|---|---|
| `src/pages/monitoramento/FilaVistorias.tsx` | Corrigir o path do Link de `/sinistros/` para `/eventos/sinistros/` (linha 723) |

Alteracao de 1 linha.

