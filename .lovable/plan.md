

# Integrar Vistorias de Evento no Sistema de Encaixe

## Diagnostico

O sistema de encaixe atual (`useEncaixesDisponiveis.ts`) consulta apenas duas tabelas: `instalacoes` e `vistorias`. Ambas possuem coluna `permite_encaixe` e coordenadas (latitude/longitude). A tabela `vistorias_evento` nao possui nenhum desses campos e nao e consultada em nenhum dos hooks de encaixe.

Resultado: vistorias de evento nunca aparecem como encaixe disponivel, nem para o regulador nem para o coordenador.

## Alteracoes Necessarias

### 1. Migracao de banco — adicionar campos a `vistorias_evento`

Adicionar colunas:
- `permite_encaixe` (boolean, default false)
- `endereco_latitude` (numeric)
- `endereco_longitude` (numeric)

### 2. Edge function `agendar-vistoria-evento` — geocodificar e aceitar encaixe

- Receber parametro `permite_encaixe` no body (opcional, default false)
- Geocodificar o endereco (rua + numero + bairro + cidade) via Nominatim para preencher lat/lng
- Gravar `permite_encaixe`, `endereco_latitude`, `endereco_longitude` no insert

### 3. Hook `useEncaixesDisponiveis` — incluir vistorias_evento

Em `useEncaixesDisponiveis`, `useTodosEncaixes`, e `useAdiantamentosProprios`:
- Adicionar query a `vistorias_evento` filtrando `permite_encaixe = true`, `status = agendada`, `regulador_id IS NULL` (para encaixes sem atribuicao)
- Mapear os resultados para `EncaixeDisponivel` com `tipo: 'vistoria_evento'`

### 4. Hooks `usePuxarEncaixe` e `useAtribuirEncaixe` — suportar tipo `vistoria_evento`

- Expandir o tipo de `'instalacao' | 'vistoria'` para incluir `'vistoria_evento'`
- Ao puxar/atribuir vistoria_evento, atualizar `regulador_id` e `permite_encaixe = false` na tabela `vistorias_evento`

### 5. Hook `useTemTarefasProximas` — verificar vistorias_evento

- Adicionar consulta a `vistorias_evento` por `regulador_id` para contabilizar tarefas proximas

### 6. Tipo `EncaixeDisponivel` — expandir

- Adicionar `'vistoria_evento'` ao campo `tipo`
- Adicionar campo opcional `sinistro_protocolo` para exibir no card

## Arquivos a modificar

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | Adicionar `permite_encaixe`, `endereco_latitude`, `endereco_longitude` a `vistorias_evento` |
| `supabase/functions/agendar-vistoria-evento/index.ts` | Geocodificar endereco, aceitar `permite_encaixe` |
| `src/hooks/useEncaixesDisponiveis.ts` | Incluir `vistorias_evento` em todos os hooks de busca, puxar e atribuir |

3 arquivos + 1 migracao.

