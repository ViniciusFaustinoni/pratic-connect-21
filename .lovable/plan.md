
## Plano — Unificar leitura de fotos do veículo em todas as telas

### Causa raiz (caso TIB8F32)

| Fonte | Quantidade | Como é lido |
|---|---|---|
| `vistoria_fotos` (vistoria `5f9c56b0…`, autovistoria, `veiculo_id=33ae2ced…`, `instalacao_id=NULL`) | **34 fotos** | modal "Detalhes do Veículo" lê via `vistorias.veiculo_id` ✅ |
| `cotacoes_vistoria_fotos` (`cotacao_id=c00806f4…`) | 3 fotos + vídeo 360 | nenhuma tela junta isso ao vehicle ❌ |
| `instalacao_fotos` (`instalacao_id=79613c9a…`) | 0 | tela de Aprovação só olha aqui ❌ |

`AprovacaoInstalacaoDetalhe.tsx` (linhas 75–110) navega só por `servico.instalacao_origem_id`/`servico.vistoria_origem_id`. Como o serviço de instalação dessa proposta tem só `instalacao_origem_id` e a vistoria das 34 fotos não está vinculada à instalação, o caminho quebra.

### Solução: resolver canônico único de fotos do veículo

#### 1) Novo helper `src/hooks/useFotosVeiculoCanonico.ts`

Reuso o padrão já consagrado em `useVeiculoDetalhes` (memória `historico-fotos-veiculo-canonico`). Recebe `{ veiculoId, contratoId?, cotacaoId?, instalacaoId? }` e retorna `{ fotos, video360, agrupadas, source }` mesclando — **com dedupe por `arquivo_url`** — as três fontes:

1. `vistoria_fotos` via `vistorias.veiculo_id = veiculoId` (canônica, captura autovistoria/presencial/troca)
2. `cotacoes_vistoria_fotos` via `cotacao_id` resolvido (`cotacao_id` direto OU `contratos.cotacao_id` quando só veio `contratoId`)
3. `instalacao_fotos` via `instalacao_id` direto OU resolvido por `instalacoes.veiculo_id`

Vídeo 360° é resolvido pela mesma ordem de prioridade (vistoria → cotacoes_vistoria_fotos `tipo=video_360`), separando `videoInstalador` (modalidade=`presencial`) de `videoAssociado` (`autovistoria`).

#### 2) Refator de `AprovacaoInstalacaoDetalhe.tsx` (linhas 75–232)

- Substituir o bloco atual de busca de fotos/vídeo pelo helper canônico, passando `veiculoId=servico.veiculo_id, contratoId=servico.contrato_id, cotacaoId=servico.cotacao_id, instalacaoId=servico.instalacao_origem_id`.
- Manter agrupamento atual (Identificação / Exterior / Interior / etc.) — só muda a **fonte** dos arrays.
- Telemetria: adicionar `console.log` com contagem por fonte para debug.

#### 3) Auditoria das demais telas que mostram fotos do mesmo veículo

Garantir que **todas** usam o resolver canônico (ou já chamam `useVeiculoDetalhes`):

| Tela | Status atual | Ação |
|---|---|---|
| `cadastro/VeiculoDetalhesModal.tsx` | ✅ usa `useVeiculoDetalhes` (canônico) | nenhuma |
| `monitoramento/AprovacaoInstalacaoDetalhe.tsx` | ❌ cadeia origem-id | **refatorar** |
| `pages/analista-eventos/EventoAnaliseDetalhe.tsx` | usar resolver | revisar |
| `troca-titularidade/VeiculoCompletoCard.tsx` | usar resolver | revisar |
| `juridico/consultas/ConsultaVeiculo.tsx` | usar resolver | revisar |
| `useGerarLaudoVistoria` / `useVistoriaCompletaAnalise` | usar resolver | revisar |

Não vou tocar comportamento de upload/escrita — só leitura. Não vou apagar tabelas — só consolidar a leitura.

#### 4) Realtime opcional (fora do escopo dessa correção, mas fica registrado)

`useFotosVeiculoCanonico` aceita flag `realtime` que assina `postgres_changes` em `vistoria_fotos`/`cotacoes_vistoria_fotos`/`instalacao_fotos` filtrando por `veiculo_id` / `cotacao_id` / `instalacao_id`. Ativo na tela de Aprovação para refletir uploads chegando ao vivo.

#### 5) Memória do projeto

Atualizar `mem://logic/operations/historico-fotos-veiculo-canonico` (ou criar `historico-fotos-veiculo-resolver-unificado`) registrando que toda tela de aprovação/análise consome o helper canônico, e que `vistoria_fotos via vistorias.veiculo_id` + `cotacoes_vistoria_fotos via cotacao_id` + `instalacao_fotos via instalacao_id` são as 3 fontes mescladas.

### Verificação após implementar

1. Abrir `/monitoramento/aprovacao-associados/<servico_id de TIB8F32>` como diretor — devem aparecer **34+ fotos agrupadas + vídeo 360°**.
2. Conferir que o modal "Detalhes do Veículo" continua mostrando 37 (= 34 vistoria + 3 cotação) sem regressão.
3. Conferir 2 ou 3 outros casos com fotos só em `cotacoes_vistoria_fotos` (autovistoria pura sub-FIPE).

### Fora de escopo

- Backfill de vínculo `vistorias.instalacao_id` em registros antigos (a leitura canônica torna isso desnecessário).
- Mudar onde o uploader grava as fotos.
- Mexer nas regras de aprovação/promoção do Cadastro.
