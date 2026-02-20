
# Enviar WhatsApp de Confirmação de Cobertura Total ao Associado

## Visão Geral do Problema

Quando a cobertura total é ativada (após instalação e vistoria concluídas), o associado **não recebe nenhuma mensagem de WhatsApp** confirmando que está totalmente protegido. O sistema já tem um template chamado `cobertura_total_ativada` em `notificar-cliente`, mas ele **nunca é chamado**.

## Fluxo Atual Identificado

Existem **3 pontos** no código onde `cobertura_total = true` é definido, e nenhum dispara o WhatsApp:

| Hook | Quando ocorre | Arquivo |
|---|---|---|
| `useAtivarRastreadorPlataforma` | Analista clica "Ativar Rastreador" na tela de análise de instalação | `src/hooks/useVistoriaCompletaAnalise.ts` linha 173 |
| `useAprovarVeiculoVistoria` | Técnico aprovam vistoria completa no campo | `src/hooks/useVistoriaCompleta.ts` linha 37 |
| `useAprovarVeiculoServico` | Aprovação de veículo via serviços (autovistoria + instalação) | `src/hooks/useServicos.ts` linha 938 |

## Template de WhatsApp Existente (pronto para usar)

O template `cobertura_total_ativada` já existe em `notificar-cliente/index.ts` (linha 46-50):

```
🛡️ Cobertura Total Ativada!
Parabéns {nome}! Seu veículo {placa} agora está com COBERTURA TOTAL ativa. 
A instalação do rastreador e vistoria foram concluídas com sucesso. Bem-vindo à PRATIC!
```

Ele já suporta as variáveis `{nome}` e `{placa}`.

## Solução

Adicionar chamada à `notificar-cliente` com o tipo `cobertura_total_ativada` nos 3 pontos onde cobertura total é ativada, **após** o sucesso das atualizações no banco, garantindo que a mensagem só é enviada quando o associado realmente está ativo.

A mensagem será enriquecida com mais informações sobre o que a cobertura total inclui (assistência 24h, sinistros de colisão, incêndio, etc.).

## Mudanças Técnicas

### 1. Melhorar o template de WhatsApp em `notificar-cliente`

O template atual é simples. Vamos enriquecê-lo com detalhes sobre o que a cobertura total inclui, mantendo o formato nativo do WhatsApp (sem HTML):

```
🛡️ *Cobertura Total Ativada!*

Parabéns {nome}! Seu veículo {placa} agora está com *COBERTURA TOTAL* ativa! ✅

*O que está incluso na sua cobertura:*
🔐 Roubo e Furto
💥 Colisão
🔥 Incêndio
🌧️ Fenômenos Naturais
🚗 Assistência 24h (guincho, pane seca, chaveiro e mais)
📍 Rastreamento em tempo real

Acesse o App PRATIC para acompanhar seu veículo e solicitar assistência quando precisar.

Bem-vindo à família PRATIC! 💙
```

### 2. Adicionar chamada em `useVistoriaCompletaAnalise.ts` (após linha 195)

Após ativar associado e antes do histórico, adicionar:

```typescript
// Notificar associado via WhatsApp sobre cobertura total ativada
try {
  const { data: veiculoInfo } = await supabase
    .from('veiculos')
    .select('placa')
    .eq('id', veiculoId)
    .single();

  await supabase.functions.invoke('notificar-cliente', {
    body: {
      tipo: 'cobertura_total_ativada',
      associado_id: associadoId,
      dados: { placa: veiculoInfo?.placa || '' },
    },
  });
} catch (notifError) {
  console.warn('[ativar-rastreador] Erro ao notificar associado (não crítico):', notifError);
}
```

### 3. Adicionar chamada em `useVistoriaCompleta.ts` (após linha 96)

No hook `useAprovarVeiculoVistoria`, após registrar no histórico (step 5), adicionar notificação:

```typescript
// Notificar associado via WhatsApp sobre cobertura total ativada
try {
  await supabase.functions.invoke('notificar-cliente', {
    body: {
      tipo: 'cobertura_total_ativada',
      associado_id: data.associadoId,
      dados: { placa: vistoriaData?.veiculos?.placa || '' },
    },
  });
} catch (notifError) {
  console.warn('[aprovar-veiculo-vistoria] Erro ao notificar (não crítico):', notifError);
}
```

### 4. Adicionar chamada em `useServicos.ts` (após linha 940, apenas quando cobertura_total for ativada)

No bloco onde `cobertura_total: true` é definido (linhas 931-943), adicionar após a atualização:

```typescript
// Notificar associado via WhatsApp sobre cobertura total ativada
try {
  const { data: veiculoInfo } = await supabase
    .from('veiculos')
    .select('placa')
    .eq('id', data.veiculoId)
    .single();

  await supabase.functions.invoke('notificar-cliente', {
    body: {
      tipo: 'cobertura_total_ativada',
      associado_id: data.associadoId,
      dados: { placa: veiculoInfo?.placa || '' },
    },
  });
} catch (notifError) {
  console.warn('[aprovar-veiculo-servico] Erro ao notificar (não crítico):', notifError);
}
```

## Garantias de Segurança

- A notificação é sempre enviada **depois** que todos os dados são confirmados no banco (cobertura_total = true, associado.status = ativo)
- Todos os `try/catch` garantem que uma falha no WhatsApp **não bloqueia** o fluxo principal de ativação
- A edge function `notificar-cliente` já valida se o associado tem telefone antes de tentar enviar

## Arquivos a Alterar

| Arquivo | Alteração |
|---|---|
| `supabase/functions/notificar-cliente/index.ts` | Melhorar o template `cobertura_total_ativada` com mensagem detalhada |
| `src/hooks/useVistoriaCompletaAnalise.ts` | Adicionar chamada à `notificar-cliente` após ativar associado |
| `src/hooks/useVistoriaCompleta.ts` | Adicionar chamada à `notificar-cliente` após aprovar veículo na vistoria |
| `src/hooks/useServicos.ts` | Adicionar chamada à `notificar-cliente` quando cobertura_total é ativada via serviços |
