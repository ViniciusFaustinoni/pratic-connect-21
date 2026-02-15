
# Correção: Links de chamados de assistência apontando para rota inexistente

## Problema

Ao clicar em um chamado de assistência, o sistema redireciona para uma página 404. Isso acontece porque os links na listagem e no dashboard estão usando a URL `/assistencia/{id}`, mas a rota correta registrada no App.tsx é `/assistencia/chamados/{id}`.

## Arquivos com o bug

| Arquivo | Linha(s) | URL errada | URL correta |
|---------|----------|-----------|-------------|
| `src/pages/assistencia/ChamadosList.tsx` | 384, 419 | `/assistencia/${chamado.id}` | `/assistencia/chamados/${chamado.id}` |
| `src/pages/assistencia/AssistenciaDashboard.tsx` | 331 | `/assistencia/${chamado.id}` | `/assistencia/chamados/${chamado.id}` |

## Correção

Alterar as 3 ocorrencias de `navigate(\`/assistencia/${chamado.id}\`)` para `navigate(\`/assistencia/chamados/${chamado.id}\`)` nos dois arquivos acima.

Nenhum arquivo novo precisa ser criado. Nenhuma migração é necessária.
