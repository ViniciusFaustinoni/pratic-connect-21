

# Fix: Clique na OS redireciona para 404

## Problema
A pagina de listagem (`/ordens-servico`) navega para `/ordens-servico/:id` ao clicar num card, mas a rota de detalhe esta registrada como `/oficinas/ordens/:id` no App.tsx.

## Solucao
Corrigir o `navigate` no arquivo `src/pages/oficinas/OrdensServico.tsx` (linha 85) para usar a rota correta:

```
// De:
onClick={() => navigate(`/ordens-servico/${os.id}`)}

// Para:
onClick={() => navigate(`/oficinas/ordens/${os.id}`)}
```

Uma unica linha a ser alterada.

