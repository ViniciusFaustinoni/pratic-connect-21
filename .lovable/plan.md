

# Vistoria de Evento nao aparece no Monitoramento

## Diagnostico

A vistoria foi criada com sucesso na tabela `vistorias_evento` (ID: `0d527f3a`, sinistro `8edba9fa`, status `agendada`, data 2026-03-05 08:30). A edge function `agendar-vistoria-evento` funcionou corretamente.

**Porem:** A pagina `/monitoramento/vistorias` (`FilaVistorias.tsx`) consulta apenas duas fontes:
- Tabela `vistorias` (vistorias de entrada/proposta) via `useVistorias`
- Tabela `servicos` (instalacoes/manutencoes) via `useServicos`

**Ela NAO consulta `vistorias_evento`** — que e onde as vistorias de sinistro sao gravadas. Essas vistorias so aparecem nas paginas do regulador (`/regulador/vistorias`), que o diretor nao acessa normalmente.

Resultado: o diretor agenda pelo link do evento, a vistoria e criada, mas nao aparece em nenhuma tela acessivel ao diretor.

## Correcao

### 1. Adicionar secao de Vistorias de Evento no `FilaVistorias.tsx`

- Importar `useVistoriasEvento` no `FilaVistorias.tsx`
- Adicionar uma secao/grupo "Vistorias de Evento" na lista, mostrando as vistorias agendadas da tabela `vistorias_evento` com dados do sinistro (protocolo, associado, veiculo, data/horario, endereco)
- Cada card tera badge de status e link para o detalhe do sinistro

### 2. Incluir contadores de vistorias de evento nos metricas

- Adicionar card de contagem "Eventos" nos contadores do topo da FilaVistorias, usando `useVistoriasEventoContadores`

### 3. RLS ja esta correta

A policy SELECT de `vistorias_evento` ja inclui `diretor` — nao precisa de alteracao de RLS.

### Arquivos a modificar

| Arquivo | Alteracao |
|---|---|
| `src/pages/monitoramento/FilaVistorias.tsx` | Importar `useVistoriasEvento`, adicionar secao de vistorias de evento na lista e contadores |

Impacto: apenas 1 arquivo alterado, sem migracao de banco.

