

# Remover Etapa de Relato do Link e Mostrar Relato da IA ao Analista

## Contexto

O relato do evento ja e coletado pela IA (via App ou WhatsApp) e armazenado no campo `sinistros.descricao`. Nao faz sentido pedir novamente no link. O analista deve ver o relato da IA, nao o do link.

## Alteracoes

### 1. Stepper - Remover etapa "Relato"

**Arquivo:** `src/components/evento/EventoStepper.tsx`

Reduzir de 5 para 4 etapas:
1. Auto Vistoria
2. B.O.
3. Agendamento
4. Pagamento

### 2. Link Publico - Pular etapa 3

**Arquivo:** `src/pages/public/EventoColisao.tsx`

- Remover import e renderizacao do `EventoEtapa3Relato`
- Ajustar logica: apos etapa 2 (B.O.), ir direto para Agendamento
- `isEtapas1a3Completas` passa a ser `isEtapas1e2Completas` (etapa_atual >= 2)
- Ajustar `getStepperPosition()` para o novo stepper de 4 etapas

### 3. Edge Function - Marcar como completado na etapa 2

**Arquivo:** `supabase/functions/salvar-etapa-evento/index.ts`

- Na etapa 2, tambem marcar `status = 'completado'` e atualizar sinistro para `documentacao_enviada`
- Remover validacao da etapa 3 (nao sera mais usada via link)
- Manter etapa 3 aceita no array de etapas validas para retrocompatibilidade, mas o fluxo principal encerra na etapa 2

### 4. Analista - Mostrar relato da IA

**Arquivo:** `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx`

Na secao "Relato do Associado" (linhas 288-326):
- Substituir `dadosEtapa3.relato_texto` por `sinistro.descricao`
- Manter exibicao de audio se houver (etapa3 antiga pode ter audio em links antigos)
- Manter dados de terceiro e local se vindos de `dadosEtapa3` (retrocompatibilidade)

### 5. Mensagem WhatsApp - Remover "Relato" das etapas

**Arquivo:** `src/components/eventos/EventoLinkCard.tsx`

Atualizar o objeto `etapasWhatsApp` para todos os tipos, removendo a etapa de relato. As etapas na mensagem passam a ser:
1. Auto Vistoria
2. Boletim de Ocorrencia
3. Agendamento
4. Cota de Coparticipacao

## Detalhes Tecnicos

### Fluxo Atualizado do Link Publico

```text
Etapa 0: Auto Vistoria (fotos + video)
Etapa 1: B.O. (upload + numero)
  -> Ao completar etapa 2, marca link como "completado"
  -> Atualiza sinistro para "documentacao_enviada"
Etapa 2 (stepper 3): Agendamento
Etapa 3 (stepper 4): Pagamento da Cota
```

### Retrocompatibilidade

Links antigos que ja possuem `dados_etapa3` preenchida continuarao funcionando. O analista mostrara `sinistro.descricao` como fonte principal do relato, com fallback para `dadosEtapa3.relato_texto` caso o campo da IA esteja vazio.

| Arquivo | Alteracao |
|---|---|
| `src/components/evento/EventoStepper.tsx` | Remover etapa "Relato", ficar com 4 etapas |
| `src/pages/public/EventoColisao.tsx` | Pular etapa 3, ir de B.O. para Agendamento |
| `supabase/functions/salvar-etapa-evento/index.ts` | Marcar completado na etapa 2 |
| `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx` | Mostrar sinistro.descricao ao inves de dadosEtapa3.relato_texto |
| `src/components/eventos/EventoLinkCard.tsx` | Remover "Relato" da mensagem WhatsApp |
