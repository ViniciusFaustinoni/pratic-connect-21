## Objetivo

Permitir que o Monitoramento estabeleça o vínculo de um rastreador físico já instalado no veículo no momento da aprovação, em **duas filas**:

1. **Aprovação de Troca de Titularidade** (`/monitoramento/aprovacoes-troca` → `ModalDetalhesTroca` em `modo='monitoramento'`).
2. **Aprovação de Associados** (`/monitoramento/aprovacoes` → `AprovacaoInstalacaoDetalhe`), que cobre os casos sub-FIPE em que o rastreador é exigido (diesel sempre) ou foi instalado por opção do associado/herdado de inclusão.

Fecha o caminho hoje aberto que faz o `ativar-associado` falhar em `requer_rastreador_fisico` (e o trigger `trg_guard_veiculo_ativo_exige_rastreador` como última linha) — caso Anderson/KPJ4994 e análogos.

Escopo limitado a **Troca + Aprovação de Associados**. Inclusão e Substituição ficam fora — entram apenas se aparecerem casos análogos.

---

## Decisões já tomadas (perguntas anteriores)

- **Vínculo por IMEI**: input manual + busca tri-fonte (estoque local → Softruck → Rede Veículos).
- **Critério "OK" para liberar aprovação**: apenas o vínculo lógico precisa existir. Comunicação fica como warning visual, não bloqueia.

---

## Comportamento esperado nas duas telas

Critério único de "exige rastreador" reusando `precisaRastreador` (`useConfigRastreador`): Diesel sempre, Carro FIPE ≥ R$ 30k, Moto FIPE ≥ R$ 9k. Sub-FIPE não-diesel: a seção aparece como opcional (botão "Vincular rastreador existente" disponível mas sem bloquear aprovação).

### Estado A — Já vinculado
Card atual do rastreador (código, IMEI, plataforma, última comunicação). Badge verde **"Rastreador vinculado"**. Aprovação livre.

### Estado B — Sem vínculo + exige rastreador
- Alerta amarelo: "Veículo exige rastreador para ser ativado".
- Input **IMEI** (15 dígitos) + botão **Buscar**.
- Resultado mostra origem (Estoque / Softruck / Rede), placa atual, status.
- Botão **Vincular ao veículo** executa `useAtivarRastreador` (já implementado, já cobre estoque local + Softruck + Rede).
- Aprovar fica desabilitado com tooltip "Vincule o rastreador antes de aprovar" enquanto não houver vínculo. Botões "Solicitar vistoria" / "Agendar manutenção" / "Devolver ao Cadastro" continuam disponíveis como alternativas.

### Estado C — Sem vínculo + não exige (sub-FIPE não-diesel)
- Seção colapsada com texto "Veículo dispensa rastreador. Vincular um existente (opcional)" + botão para expandir.
- Mesma UX do estado B se expandido, mas **sem bloquear aprovação**.

### Bloqueios de segurança (espelhando regra canônica `intencao-rastreador-fallback-monitoramento`)
- IMEI `instalado` em outro veículo ativo → bloqueia com mensagem clara (placa + associado conflitantes).
- IMEI vindo só da plataforma sem registro local → cria `rastreadores` com `status='instalado'` antes de vincular (o `useAtivarRastreador` atual já assume que existe; vamos estender o fluxo para criar o registro quando a tri-fonte achar só na plataforma).

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| **Novo** `src/hooks/useBuscarRastreadorPorImei.ts` | Hook único orquestrando estoque local + `softruck-buscar-dispositivo` + `rede-veiculos-buscar-veiculo`. Retorna `{ origem, rastreador, conflito? }`. |
| **Novo** `src/components/rastreadores/VincularRastreadorExistenteCard.tsx` | Componente isolado: input IMEI, busca, card resultado, botão vincular. Aceita props `{ veiculoId, associadoId, exigeRastreador, onVinculado }`. Reusa `useAtivarRastreador`. |
| `src/components/troca-titularidade/VeiculoCompletoCard.tsx` | Renderiza `VincularRastreadorExistenteCard` dentro do `RastreadorBlock` quando passar prop `modo='monitoramento'` e estado B/C. |
| `src/components/troca-titularidade/ModalDetalhesTroca.tsx` | Computar `precisaVinculoRastreador`, propagar `modo` para o card, desabilitar botão Aprovar com tooltip canônico no estado B sem vínculo. |
| `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx` | Logo abaixo do bloco existente de "Rastreador" (linha ~624), renderizar `VincularRastreadorExistenteCard` quando aplicável. Estender o gate "FALTA_RASTREADOR_FISICO" para considerar vínculo recém-criado (invalidação de query já cuida). |
| Reuso sem alteração: `useAtivarRastreador`, `softruck-buscar-dispositivo`, `softruck-ativar-dispositivo`, `rede-veiculos-buscar-veiculo`, `rede-veiculos-vincular-cliente`, `precisaRastreador`. |

Edge function nova só se a busca por IMEI na Softruck/Rede não existir hoje em endpoint reutilizável — vou verificar no momento da execução; se faltar, crio adapter por dentro do hook usando as funções existentes.

Nenhuma migration. Nenhum guard de banco alterado. `trg_guard_veiculo_ativo_exige_rastreador` continua sendo a última linha de defesa.

---

## Auditoria

Após vínculo bem-sucedido: `registrarLog` (`acao='editar'`, `tabela='rastreadores'`, descrição `[VINCULO_MONITORAMENTO_{TROCA|APROVACAO}]` + placa + IMEI + id da solicitação/instalação). Compatível com `vigia-universal-logs-auditoria`.

---

## Memória a registrar após implementar

`mem://logic/operations/vincular-rastreador-existente-monitoramento` consolidando:
- Componente canônico: `VincularRastreadorExistenteCard` + hook `useBuscarRastreadorPorImei`.
- Aparece em duas filas (Aprovação de Associados + Aprovação de Troca).
- Reusa `useAtivarRastreador`; bloqueia por IMEI duplicado; comunicação não-bloqueante; sub-FIPE não-diesel é opcional.
- Triggers DB seguem como última linha.

---

## Validação

1. **Caso Anderson/KPJ4994** (Troca, já em rollback): abrir modal em Monitoramento, ver estado B, digitar IMEI, vincular, aprovar — `efetivar-troca-titularidade` segue, `ativar-associado` aceita.
2. **Sub-FIPE diesel** (Aprovação de Associados): mesma UX, mesmo gate.
3. **Sub-FIPE não-diesel**: seção opcional, aprovação livre mesmo sem vincular.
4. **IMEI em outro veículo ativo**: bloqueio com mensagem clara, sem corromper estado.
5. **IMEI só na plataforma (não em estoque local)**: registro `rastreadores` criado em `instalado` + vínculo lógico no veículo.