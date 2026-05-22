## Adendo final — "Tratar como Manutenção" reaproveita badge `vistoria_manutencao` (indigo) já existente

### Entendi a observação dos badges

A área de serviços já tem um sistema canônico de badges por tipo, em `src/components/servicos-campo/ServicoTipoBadge.tsx`:

| Tipo | Cor | Ícone |
|---|---|---|
| `instalacao` | azul | Wrench |
| `vistoria_entrada` | esmeralda | ClipboardCheck |
| `vistoria_saida` | âmbar | ClipboardCheck |
| `vistoria_sinistro` | vermelho | AlertOctagon |
| `vistoria_periodica` | ciano | FileSearch |
| **`vistoria_manutencao`** | **indigo** | **Settings** |
| `vistoria_retirada` | roxo | PackageX |
| `revistoria` | teal | RefreshCw |

**Então não vou inventar badge laranja novo.** O fluxo "Tratar como Manutenção" vai usar a cor + ícone **indigo / Settings** que já é canônico para manutenção.

### Como isso muda o adendo

**Antes:** eu propus "marcar `intencao_rastreador='manutencao'` mantendo `servicos.tipo='instalacao'/'vistoria_entrada'`".

**Agora (alinhado ao sistema de badges existente):** quando o Monitoramento clica em **"Tratar como Manutenção"**, o serviço é **convertido para `tipo='vistoria_manutencao'`** — exatamente o tipo que o `ServicoTipoBadge` já sabe pintar de indigo com ícone Settings.

Isso resolve badges em **todas as superfícies de uma vez**, sem código novo de UI:
- `ServicosTable`, `ServicosMetricasCards`, `ServicosFilters` — todos já consomem `ServicoTipoBadge`
- Card da fila Aprovação de Associados (Monitoramento) — exibe o mesmo badge
- Tela de Atribuição Manual — exibe o mesmo badge
- App do instalador / drawer do veículo / histórico do veículo — todos consomem o mesmo componente

Zero badge novo. Zero cor hardcoded. Zero `BadgeManutencao` próprio.

### Implicações do uso de `vistoria_manutencao`

Como `vistoria_manutencao` já existe como tipo de serviço com fluxo próprio (na aba Manutenção interna, ver `mem://features/operations/field-services-maintenance-tab-v2`), precisamos garantir que o serviço **criado/convertido pelo Monitoramento** seja distinguível por **origem**, não por tipo:

- `servicos.origem='monitoramento_aprovacao'` (valor novo) → identifica que veio do fallback do Monitoramento
- `servicos.motivo_manutencao='Manutenção via Monitoramento — IMEI XXXXXXXXXXXXXXX'` → tooltip já mostra esse texto
- `servicos.instalacao_origem_id` / `servicos.vistoria_origem_id` preservados → linka de volta à proposta original
- `servicos.intencao_rastreador_imei` / `intencao_rastreador_rastreador_id` → IMEI esperado e (quando aplicável) o UUID do rastreador já vinculado

A regra "uma origem = um serviço vivo" (`mem://logic/operations/servicos-um-canonico-por-origem`) continua intacta: o serviço original `instalacao`/`vistoria_entrada` é **fechado** (status terminal não-positivo, ex. `cancelada` com motivo "convertido para manutenção") **no mesmo commit** em que o novo `vistoria_manutencao` é criado.

### Pré-condição checada na busca tri-fonte

Operador digita IMEI → busca local + Softruck + Rede:

| Resultado | O que cria |
|---|---|
| Em estoque local | Vincula rastreador ao veículo (`useAtivarRastreador`) + cria `vistoria_manutencao` agendada |
| Já instalado neste mesmo veículo | Só cria `vistoria_manutencao` (vínculo já existe) |
| Instalado em OUTRO veículo ativo | **Bloqueia** com alerta — não cria nada |
| Existe só na Softruck/Rede | "Cadastrar e vincular" → cria linha em `rastreadores` + vincula + cria serviço |
| Não encontrado | Cria `vistoria_manutencao` com IMEI esperado mas sem vínculo (técnico cadastra em campo) |

### App do instalador

Como o serviço agora é genuinamente `vistoria_manutencao`, ele entra pelo branch **já existente** do app do instalador para esse tipo (sub-fluxo `Settings` indigo, sem "Cadastrar novo rastreador" obrigatório).

Adições mínimas dentro do branch:
- Banner topo com IMEI esperado (lido de `servicos.intencao_rastreador_imei`)
- Foto obrigatória `tipo='rastreador_existente'`
- Botão de escape **"Não é esse rastreador / precisei substituir"** → libera fluxo de "Cadastrar novo rastreador" + grava novo IMEI no vínculo

### Guards DB — passam naturalmente

- `trg_guard_instalacao_concluida_exige_rastreador` — **não se aplica** (o serviço não é mais `instalacao`)
- `trg_guard_veiculo_ativo_exige_rastreador` — passa porque o vínculo do rastreador foi criado/confirmado no ato pelo Monitoramento
- `trg_guard_servico_autovistoria_concluida` — não se aplica (não é autovistoria)
- `trg_guard_cobertura_rf_exige_decisao_cadastro` — intocado

### O que **não** muda (invariantes preservados)

- Detecção automática Diesel / FIPE ≥ 30k / Moto ≥ 9k — intocada
- `dispensa_rastreador` — intocado
- Fluxos paralelos: Troca, Substituição, Revistoria, Adesão, Inclusão, sub-FIPE, autovistoria 2 fotos+360°, Cadastro, SGA, `ativar-associado`, `cobertura_360_ativada_v3`
- Aba Manutenção interna (`vistoria_manutencao` criada manualmente) — segue funcionando igual; filtramos por `origem` quando precisar diferenciar

### Migration mínima

Em `servicos`:
- `intencao_rastreador_imei TEXT NULL`
- `intencao_rastreador_rastreador_id UUID NULL REFERENCES rastreadores(id)`
- Adicionar valor `'monitoramento_aprovacao'` ao enum/text de `origem` (ou usar `solicitado_por_modulo`)

### Arquivos envolvidos

- Migration (colunas + valor de origem)
- **Novo** `src/components/monitoramento/MarcarManutencaoDialog.tsx` (reaproveita visual do `VincularRastreadorForm`)
- **Novo** `src/hooks/useBuscarRastreadorTriFonte.ts`
- **Novo** `src/hooks/useConverterParaManutencao.ts` — encerra o serviço antigo + cria `vistoria_manutencao` + (opcional) chama `useAtivarRastreador`
- `src/components/monitoramento/AprovacaoInstalacaoDetalhe.tsx` — botão "Tratar como Manutenção" + dialog
- App do instalador (`src/pages/instalador/...`, `src/components/servicos-campo/`) — banner IMEI esperado + foto `rastreador_existente` + botão escape no branch `vistoria_manutencao`
- 1 leaf de memória + update do índice

### Memória a salvar (após aprovar)

`mem://logic/operations/intencao-rastreador-fallback-monitoramento`:
> "Botão 'Tratar como Manutenção' no Monitoramento converte o serviço de `instalacao`/`vistoria_entrada` para `vistoria_manutencao` (badge indigo + ícone Settings — já canônico em `ServicoTipoBadge`). Usa motor de busca tri-fonte (local + Softruck + Rede) por IMEI; vincula imediatamente se achar em estoque; só cria o serviço se já for o mesmo veículo; bloqueia se for outro veículo ativo. Diferencia da manutenção interna pela `origem='monitoramento_aprovacao'`. Serviço antigo é fechado no mesmo commit (1-origem-1-serviço-vivo). App do instalador entra pelo branch existente de `vistoria_manutencao` + banner IMEI esperado + foto `rastreador_existente` + escape para cadastro normal. Guards DB passam naturalmente. Não afeta Troca, Substituição, Revistoria, Adesão, sub-FIPE, autovistoria, SGA, ativar-associado."

### Fora de escopo

- Inventar badge/cor novos (usamos o indigo/Settings já existente)
- Nova rota no app do instalador (só adições no branch `vistoria_manutencao` já existente)
- Mexer em `dispensa_rastreador` ou detecção automática FIPE/Diesel

Confirma esse desenho final (badge canônico `vistoria_manutencao` indigo, sem cor nova) pra eu mudar pra build e executar?
