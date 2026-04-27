# Veículos com FIPE < R$ 30k (carro) / R$ 9k (moto), não-Diesel — fluxo sem instalação

## Regra (sua especificação)
1. **Link público de vistoria** continua sendo gerado, mas **apenas com a etapa de imagens**. A etapa de instalação não aparece.
2. **Tarefa atribuída ao técnico** também dispensa a etapa de instalação — mostra somente fotos e vídeo.
3. Quando o cliente concluir as imagens pelo link público, o veículo é considerado **pronto** (sem precisar visita técnica).

## Estado atual (auditoria)

| Camada | Hoje |
|---|---|
| `aprovar-proposta` | Cria registro em `instalacoes` **apenas** se `veiculoPrecisaRastreador=true`. Para FIPE baixo: ativa Proteção 360 direto, **sem link público**. |
| `gerar-link-vistoria-publica` | Exige `instalacao_id` (NOT NULL na tabela `vistoria_links`). |
| `VistoriaPublica.tsx` | Sempre exibe os dois cards: **Etapa Fotos** + **Etapa Instalação**. Não consulta a flag de exigência. |
| `concluir-etapa-fotos-publica` | Marca só `fotos_etapa_status='concluida'`. Sempre deixa o link aguardando instalação. |
| `ExecutarVistoriaCompleta.tsx` (técnico) | ✅ Já filtra categorias `instalacao`/`rastreador` quando `veiculoPrecisaRastreador=false`. |
| BD: `vistoria_links.exige_etapa_instalacao` | ✅ Coluna criada na migração anterior, com backfill. |

## Plano revisado

### 1. `aprovar-proposta` — sempre criar instalação + link
- Remover o `if (veiculoPrecisaRastreador)` que envolve a criação da `instalacao`.
- **Sempre** criar registro em `instalacoes` (mesmo para FIPE baixo) — necessário porque `vistoria_links.instalacao_id` é NOT NULL e é referência para todo o pipeline público.
- Para veículos sem rastreador, marcar a instalação com `local_vistoria='cliente'` e gravar marcador `dispensa_rastreador=true` (nova coluna em `instalacoes`).
- A chamada para `gerar-link-vistoria-publica` passa a rodar para **todos** os veículos.
- A ativação imediata de Proteção 360 para veículos sem rastreador **continua** acontecendo nesse passo (não esperar fotos).

### 2. `instalacoes` — novo marcador
- Nova coluna `instalacoes.dispensa_rastreador boolean default false`.
- Backfill: marcar `true` para instalações cujos veículos dispensam rastreador (mesma regra FIPE/Diesel já usada).

### 3. `gerar-link-vistoria-publica`
- Após resolver `instalacao_id`, buscar `instalacoes.dispensa_rastreador`.
- Gravar `vistoria_links.exige_etapa_instalacao = !dispensa_rastreador` no insert.
- Atualizar a flag mesmo em links já existentes (caso a regra mude).

### 4. `VistoriaPublica.tsx` — UI condicional
- Carregar `link.exige_etapa_instalacao`.
- Quando `false`:
  - **Esconder** o card "Instalação" e o aviso de login do técnico.
  - Após concluir a etapa de fotos, mostrar tela de **conclusão final** (não "aguardando técnico").
- Quando `true`: comportamento atual (2 etapas).

### 5. `concluir-etapa-fotos-publica` — autocompletar quando dispensa
- Ler `link.exige_etapa_instalacao`.
- Quando `false`, no mesmo update:
  - `instalacao_etapa_status = 'concluida'`
  - `instalacao_concluida_em = now()`
  - `fotos_aprovadas_em = now()` (auto-aprovado, sem fila do monitoramento)
- Atualizar `instalacoes.status = 'concluida'` para fechar o ciclo.
- Aplicar dedupe (regra `mem://logic/operations/dedupe-agendamentos-rule`): fechar `servicos`/`agendamentos_base` órfãos do par associado+veículo.

### 6. Tarefa do técnico — confirmação
- `ExecutarVistoriaCompleta.tsx` já trata o caso (linha 290 — `agruparFotosFiltradas(tipo, veiculoPrecisaRastreador)`). **Nada a alterar.**
- Confirmação adicional: na tela de criação manual de instalação (`InstalacaoFormDialog`), avisar visualmente quando o veículo dispensa rastreador para que o técnico saiba que sua tarefa terá só fotos.

### 7. Atribuição manual / fila
- Cards na fila de atribuição (`AtribuicaoManualTab`) ganham um badge "Sem instalação" para veículos que dispensam rastreador, evitando confusão do operador ao atribuir.

### 8. Memória
- Salvar `mem://logic/operations/vistoria-sem-rastreador-flow`:
> Veículos com FIPE < R$ 30k (carro) / R$ 9k (moto), não-Diesel: `aprovar-proposta` cria a instalação com `dispensa_rastreador=true` e gera link público; `vistoria_links.exige_etapa_instalacao=false`; `VistoriaPublica.tsx` mostra só etapa de fotos; `concluir-etapa-fotos-publica` marca instalação como concluída e auto-aprova; tarefa do técnico (`ExecutarVistoriaCompleta`) já filtra categorias `instalacao`/`rastreador` via `veiculoPrecisaRastreador`.

## O que **NÃO** será alterado
- `precisaRastreador()` em `useConfigRastreador.ts` — fonte única.
- Schema de `vistoria_links` (já tem `exige_etapa_instalacao` + backfill da migração anterior).
- `ExecutarVistoriaCompleta.tsx` — já correto.

## Confirmações antes de implementar

1. **Auto-aprovação das fotos** quando dispensa rastreador (sem passar pela fila do monitoramento), correto? Ou prefere que vá para fila igual hoje?
2. Posso prosseguir com a criação da `instalacao` mesmo para FIPE baixo (necessário pela FK)? A alternativa de tornar `instalacao_id` nullable mexe em vários edges.

Aprova?