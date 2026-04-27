# Veículos sem rastreador (FIPE < R$ 30k carro / R$ 9k moto, não-Diesel)

## Regra
- **Tarefa do técnico** não deve exigir etapa de instalação — só fotos e vídeo.
- **Link público de vistoria** deve permitir concluir só com fotos, sem segunda etapa.
- Ao concluir as fotos, **veículo é considerado pronto** (Proteção 360 ativa, sem agendar visita técnica).

## Estado atual (auditoria)

| Camada | Já correto? | Precisa de ajuste? |
|---|---|---|
| `aprovar-proposta` — não cria instalação para veículo sem rastreador | ✅ | — |
| `ExecutarVistoriaCompleta.tsx` (técnico) — filtra categorias `instalacao`/`rastreador` via `veiculoPrecisaRastreador` | ✅ | — |
| `CotacaoPublicaCompleta.tsx` — lógica **invertida** ao escolher entre 18 fotos / 31 fotos | ❌ | Linhas 126-128 e 141-143 |
| `VistoriaPublica.tsx` (link público pós-aprovação) — sempre mostra 2 etapas (Fotos + Instalação) | ❌ | Não considera a regra |
| `concluir-etapa-fotos-publica` (edge) — sempre deixa o link aguardando etapa de instalação | ❌ | Não considera a regra |
| Geração do link público — só dispara quando `veiculoPrecisaRastreador = true` | ❌ | Decidir se queremos link mesmo sem rastreador (ver decisão abaixo) |

## Decisão de produto que precisa ser confirmada

Hoje, quando o veículo dispensa rastreador, **nenhum link público é criado** — `aprovar-proposta` ativa Proteção 360 direto, sem fotos. A regra do usuário ("se acessado pelo link público, e realizadas as imagens, prossegue sem instalação") sugere que mesmo nesses casos queremos que o cliente faça as fotos.

**Vou assumir o caminho A** (mais alinhado ao texto da regra): gerar o link público sempre, com etapa de instalação opcional. Se preferir o caminho B (manter ativação direta sem fotos), corrijo só os 3 pontos da UI/edge sem mexer em `aprovar-proposta`.

## Plano de implementação (caminho A)

### 1. Banco — campo de exigência por instalação
- Adicionar `vistoria_links.exige_etapa_instalacao boolean default true`.
- Backfill: marcar `false` para links cujo veículo dispensa rastreador (FIPE < limite + não-Diesel).

### 2. `aprovar-proposta`
- Sempre gerar link público de vistoria (mover a chamada `gerar-link-vistoria-publica` para fora do `if (veiculoPrecisaRastreador)`).
- Passar `exige_etapa_instalacao = veiculoPrecisaRastreador` para o gerador.
- Para veículos sem rastreador, ainda **não criar registro em `instalacoes`** (mantém comportamento atual de Proteção 360 imediata).

### 3. `gerar-link-vistoria-publica`
- Aceitar e gravar a flag `exige_etapa_instalacao` no insert.

### 4. `VistoriaPublica.tsx`
- Ler `link.exige_etapa_instalacao`. Quando `false`:
  - `HomeEtapas`: ocultar o card "Instalação" e o aviso de login do técnico.
  - Após concluir fotos, redirecionar para tela de "concluído" sem aguardar aprovação/instalação.

### 5. `concluir-etapa-fotos-publica` (edge)
- Quando `link.exige_etapa_instalacao === false`:
  - Setar `instalacao_etapa_status = 'concluida'` no mesmo update.
  - Marcar `fotos_aprovadas_em = now()` (auto-aprovação — fotos vão direto para análise OCR/manual normal, mas não bloqueiam a finalização).
  - Garantir `veiculos.cobertura_total = true` e `veiculos.status = 'ativo'` se ainda não estiverem.
  - Aplicar regra de **dedupe** já existente (`mem://logic/operations/dedupe-agendamentos-rule`): fechar quaisquer `servicos`/`agendamentos_base` órfãos do par associado+veículo.

### 6. `CotacaoPublicaCompleta.tsx` (correção do bug existente)
- Linhas 126-128: inverter — usar `FOTOS_VISTORIA_COMPLETA_CLIENTE` (31 fotos) **quando** `veiculoPrecisaRastreador === false`. Hoje a condição está trocada.
- Linha 141-143: inicializar `fotosVistoria` com `fotosVistoriaConfig` derivado do flag, não a constante padrão.

### 7. Memória do projeto
Adicionar `mem://logic/operations/vistoria-sem-rastreador-flow`:
> Veículos abaixo de R$ 30k (carro) / R$ 9k (moto), não-Diesel: vistoria pública conclui só com fotos+vídeo; sem etapa de instalação; sem agendamento técnico. Backend marca `instalacao_etapa_status='concluida'` ao receber as fotos. Tarefa do técnico (`ExecutarVistoriaCompleta`) já filtra categorias `instalacao`/`rastreador` quando `veiculoPrecisaRastreador=false`.

## O que **NÃO** será alterado

- `ExecutarVistoriaCompleta.tsx` — já trata o caso corretamente.
- Cálculo de `precisaRastreador()` em `useConfigRastreador.ts` — fonte única, não duplicar.
- Tarefa do técnico para veículos com rastreador — fluxo atual permanece.

## Confirmações que preciso

1. **Caminho A (gerar link público sempre) ou B (manter ativação direta sem fotos para veículos < R$ 30k)?**
2. Se A: as fotos do link público de veículo sem rastreador devem **passar pela aprovação manual do monitoramento** (igual veículos com rastreador) ou **auto-aprovar** ao concluir?

Aprova o caminho A com auto-aprovação? Ou prefere outra combinação?