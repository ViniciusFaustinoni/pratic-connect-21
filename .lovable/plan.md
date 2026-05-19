# Ajuste: Cadastro avalia somente documentos + autovistoria enxuta (acima FIPE)

## Regra canônica (confirmada)

Cadastro **apenas**:
1. **Documentos** (sempre).
2. **Autovistoria ENXUTA** (acima FIPE, opcional, 2 fotos + vídeo 360°) — quando o cliente faz, libera R/F antecipado.

Cadastro **NÃO avalia**:
- Vistoria presencial técnica (base, rota, prestador, fit) — Monitoramento decide.
- **Autovistoria COMPLETA sub-FIPE** (31 fotos carros / 15 motos + vídeo) — vai direto ao Monitoramento avaliar e aprovar.

Em todos os casos não-cobertos, Cadastro aprova apenas a documentação; aprovação final é do Monitoramento (com auto-promoção via trigger para vistoria presencial concluída).

## Caso RJK2I25 (Tiago Moreira Miranda)
- Vistoria presencial **na base** com 31 fotos + vídeo já enviados.
- Stepper atual mostra "Fotos & Vistoria" + botão "Aprovar Proposta" — incorreto.
- Esperado: stepper só com "Documentos → Aprovação Final" (banner: aguardando técnico finalizar; aprovação do Monitoramento).

## Mudanças (técnico)

### 1. `src/pages/cadastro/PropostaAnalise.tsx`

Derivar flags novas:
```ts
const isVistoriaPresencialTecnica =
  !isAutovistoria && proposta?.vistoria?.modalidade === 'presencial';

const isAutovistoriaCompletaSubFipe =
  isAutovistoria && autovistoriaCompleta; // sub-FIPE = autovistoria completa

const cadastroAvaliaApenasEnxuta =
  isAutovistoria && !autovistoriaCompleta; // enxuta acima FIPE
```

Ajustar `cadastroAvaliaFotos` para incluir SÓ enxuta acima FIPE:
```ts
const cadastroAvaliaFotos =
  planoTemRouboFurto &&
  temFotosOuVideo &&
  cadastroAvaliaApenasEnxuta;
```

Estender `aprovarApenasDocumentos` para cobrir presencial técnica E sub-FIPE completa:
```ts
const aprovarApenasDocumentos =
  !planoTemRouboFurto ||
  isVistoriaAgendadaSemFotos ||
  isVistoriaPresencialTecnica ||
  isAutovistoriaCompletaSubFipe;
```

Passar `aguardandoMonitoramentoVistoria={isVistoriaPresencialTecnica || isAutovistoriaCompletaSubFipe}` ao stepper.

### 2. `src/components/cadastro/proposta/PropostaApprovalStepper.tsx`

- Aceitar prop `aguardandoMonitoramentoVistoria?: boolean`.
- Quando true e step1 (docs) aprovado: substituir botão "Aprovar Proposta" por banner verde "Documentos aprovados. Aprovação final é do Monitoramento."
- Step "Fotos & Vistoria" oculto neste modo (já garantido por `cadastroAvaliaFotos=false`).

### 3. Backend
Sem mudanças — triggers `trg_servico_promove_cadastro` (presencial técnica) e fluxo sub-FIPE (Monitoramento) já cuidam da promoção.

## Verificação
- RJK2I25 (presencial base + 31 fotos): stepper "Documentos → Aprovação Final", sem botão de aprovar fotos.
- Sub-FIPE com autovistoria completa: idem — Cadastro só docs, fotos vão p/ Monitoramento.
- Autovistoria enxuta acima FIPE: Cadastro continua avaliando fotos (libera R/F).
- Plano sem R/F: inalterado (só docs).

## Fora de escopo
- Edge functions, triggers, tela de Monitoramento, fluxo de titularidade.

## Memória a atualizar (após aprovação)
`mem://logic/operations/vistoria-sem-rastreador-flow` — refletir que sub-FIPE não passa por avaliação de fotos no Cadastro (só docs); Monitoramento avalia fotos + aprova.
