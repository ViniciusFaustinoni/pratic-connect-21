
# Revisao Completa - WhatsApp via Evolution API no Modulo de Assistencia 24h

## Resumo Executivo

| Momento do Fluxo | Status WhatsApp | Implementacao Atual |
|------------------|-----------------|---------------------|
| 1. Chamado aberto - confirmacao com protocolo | **PARCIAL** | Envia apenas para central, NAO para associado |
| 2. Prestador acionado - previsao | **NAO IMPLEMENTADO** | Apenas toast local, sem WhatsApp |
| 3. Prestador a caminho - contato | **MANUAL** | Botao existe mas precisa ser clicado manualmente |
| 4. Servico iniciado - confirmacao | **NAO IMPLEMENTADO** | Sem notificacao |
| 5. Servico concluido - pesquisa satisfacao | **NAO IMPLEMENTADO** | Sem WhatsApp |
| 6. Atualizacao de status - tempo real | **NAO IMPLEMENTADO** | Sem notificacao automatica |
| Associado abre chamado via WhatsApp | **PARCIAL** | Cria solicitacao para aprovacao, nao chamado direto |
| Localizacao do associado capturada | **OK** | Tool reverse_geocode funciona |
| Contato do prestador compartilhado | **MANUAL** | Funciona via botao ou tool IA |
| Historico registrado | **OK** | Tabela chamados_assistencia_historico |

---

## Analise Detalhada

### 1. Chamado Aberto - Confirmacao com Protocolo - PARCIAL

**Situacao atual:** `criar-chamado-assistencia/index.ts` linha 352-386

O sistema envia WhatsApp para a **central** quando chamado e aberto:

```typescript
// Linha 351-371 - Envia apenas para CENTRAL
if (telefoneCentral) {
  const mensagemCentral = `🚨 *NOVO CHAMADO DE ASSISTÊNCIA*...`;
  await supabaseAdmin.functions.invoke('whatsapp-send-media', { ... });
}
```

Porem, **NAO envia WhatsApp de confirmacao para o ASSOCIADO**. Apenas cria notificacao no sistema (linha 392-405).

**Gap:** Associado nao recebe WhatsApp confirmando abertura do chamado com protocolo.

### 2. Prestador Acionado - Previsao - NAO IMPLEMENTADO

**Situacao atual:** `AtribuirPrestadorModal.tsx` linha 94-149

Quando prestador e acionado:
- Atualiza tabela `chamados_assistencia` com `prestador_nome` e `prestador_telefone`
- Cria registro em `chamados_assistencia_atendimentos` com status `acionado`
- Registra no historico

**Gap:** NAO envia WhatsApp para associado informando que prestador foi acionado.

O template existe em `notificar-cliente`:
```typescript
assistencia_prestador_acionado: {
  titulo: '🚗 Prestador Acionado',
  mensagem: 'Olá! O prestador {prestador_nome} foi acionado para atendê-lo...',
}
```

Porem **nunca e chamado** no fluxo.

### 3. Prestador a Caminho - Contato - MANUAL

**Situacao atual:** `EnviarLinkPrestadorButton.tsx`

Existe botao no painel para:
- Enviar localizacao (PIN) para prestador
- Enviar mensagem de texto com detalhes
- Enviar contato do prestador para associado

**Gap:** Tudo e **manual**. Quando status muda para `prestador_a_caminho`, deveria enviar automaticamente:
- Notificacao para associado com previsao e contato
- Localizacao atualizada para prestador (se rastreador disponivel)

### 4. Servico Iniciado - Confirmacao - NAO IMPLEMENTADO

**Situacao atual:** `AtualizarStatusChamadoModal.tsx`

Quando status muda para `em_atendimento`:
- Atualiza banco de dados
- Registra no historico
- **NAO envia WhatsApp**

**Gap:** Associado nao recebe confirmacao de que atendimento iniciou.

### 5. Servico Concluido - Pesquisa Satisfacao - NAO IMPLEMENTADO

**Situacao atual:** `AtualizarStatusChamadoModal.tsx` linha 78-101

Quando status muda para `concluido`:
- Captura posicao final do rastreador
- Atualiza `data_conclusao`
- **NAO envia WhatsApp com pesquisa de satisfacao**

**Gap:** 
- Associado nao recebe confirmacao de conclusao
- Nao ha link para avaliar o atendimento
- Template `concluido` em `disparar-notificacao` nao inclui link de avaliacao

O template existe mas e basico:
```typescript
concluido: {
  titulo: 'Atendimento Concluído',
  mensagem: 'Seu chamado foi concluído. Avalie o atendimento!',
}
```

### 6. Atualizacao de Status - Tempo Real - NAO IMPLEMENTADO

**Situacao atual:** Nao existe trigger ou funcao para notificar associado quando status muda.

**Gap:** Associado precisa abrir o app para ver atualizacoes. Nao recebe notificacao push/WhatsApp.

---

## Abertura de Chamado via WhatsApp - PARCIAL

**Situacao atual:** `whatsapp-webhook/index.ts` linha 573-613

A IA do WhatsApp pode criar solicitacao de assistencia, mas:
- Cria registro em `chat_solicitacoes_ia` (nao em `chamados_assistencia`)
- Requer aprovacao de diretor
- Nao abre chamado diretamente

```typescript
case "criar_solicitacao_assistencia": {
  const { data } = await supabase.from("chat_solicitacoes_ia").insert({
    associado_id: associadoId,
    tipo: "assistencia",
    dados: { ... },
    status: "pendente",
  });
  return JSON.stringify({
    message: "Solicitação de assistência registrada! Um diretor irá aprovar em breve.",
  });
}
```

**Gap:** Nao ha fluxo para aprovar e criar chamado automaticamente. Diretor precisa aprovar manualmente.

---

## Localizacao Enviada pelo Associado - OK

**Situacao atual:** `whatsapp-webhook/index.ts` linha 615-665

Tool `reverse_geocode` funciona corretamente:
- Recebe latitude/longitude
- Converte para endereco via Nominatim
- Retorna endereco formatado para IA usar

**Status:** Funcionando.

---

## Contato do Prestador Compartilhado - PARCIAL

**Situacao atual:** 

1. **Via IA (tool):** `whatsapp-webhook/index.ts` linha 996-1093
   - Tool `enviar_contato_prestador` funciona
   - Envia cartao de contato via Evolution API
   - Associado precisa pedir via chat

2. **Via painel:** `EnviarLinkPrestadorButton.tsx`
   - Botao "Enviar Contato ao Associado" funciona
   - Atendente precisa clicar manualmente

**Gap:** Nao e automatico. Deveria enviar quando prestador e despachado.

---

## Plano de Implementacao

### Fase 1: Notificacoes Automaticas por Status

**Criar edge function:** `supabase/functions/notificar-status-assistencia/index.ts`

Esta funcao sera chamada:
- Via trigger no banco ao mudar status de chamado
- Ou manualmente pelo frontend ao atualizar status

```typescript
// Mapeamento de status para notificacao
const NOTIFICACOES_POR_STATUS = {
  aberto: {
    titulo: '✅ Chamado Registrado!',
    mensagem: 'Seu chamado de {tipo_servico} foi registrado. Protocolo: {protocolo}. Em breve um prestador será acionado.',
  },
  aguardando_prestador: {
    titulo: '🚗 Prestador Acionado',
    mensagem: 'O prestador {prestador_nome} foi acionado para atendê-lo. Previsão: 30-45 minutos.',
  },
  prestador_a_caminho: {
    titulo: '🚚 Prestador a Caminho!',
    mensagem: 'O prestador {prestador_nome} está a caminho. Telefone: {prestador_telefone}',
    enviar_contato: true,
  },
  em_atendimento: {
    titulo: '🔧 Atendimento Iniciado',
    mensagem: 'O prestador chegou e iniciou o atendimento do seu chamado {protocolo}.',
  },
  concluido: {
    titulo: '✅ Atendimento Concluído!',
    mensagem: 'Seu chamado {protocolo} foi concluído. Como foi o atendimento? Avalie: {link_avaliacao}',
    enviar_link_avaliacao: true,
  },
  cancelado_sistema: {
    titulo: '❌ Chamado Cancelado',
    mensagem: 'Seu chamado {protocolo} foi cancelado. Motivo: {motivo}',
  },
};
```

### Fase 2: Enviar Confirmacao ao Associado na Abertura

**Modificar:** `supabase/functions/criar-chamado-assistencia/index.ts`

Adicionar apos criar chamado (linha 340):

```typescript
// Enviar confirmacao para ASSOCIADO
if (associado.whatsapp || associado.telefone) {
  await supabaseAdmin.functions.invoke('whatsapp-send-text', {
    body: {
      telefone: (associado.whatsapp || associado.telefone).replace(/\D/g, ''),
      mensagem: `✅ *Chamado Registrado!*

📋 Protocolo: ${protocolo}
🔧 Tipo: ${TIPO_LABELS[payload.tipo_assistencia]}

Em breve um prestador será acionado para atendê-lo.
Aguarde nossa confirmação.`,
    },
  });
}
```

### Fase 3: Notificar ao Atribuir Prestador

**Modificar:** `src/components/assistencia/AtribuirPrestadorModal.tsx`

Apos criar atendimento (linha 124), adicionar:

```typescript
// Notificar associado via WhatsApp
await supabase.functions.invoke('notificar-cliente', {
  body: {
    tipo: 'assistencia_prestador_acionado',
    associado_id: chamado.associado_id,
    dados: {
      prestador_nome: prestador.nome_fantasia || prestador.razao_social,
      previsao: '30-45 minutos',
      protocolo: chamado.protocolo,
    },
  },
});
```

### Fase 4: Notificar ao Mudar Status

**Modificar:** `src/components/assistencia/AtualizarStatusChamadoModal.tsx`

Adicionar chamada para notificacao apos atualizar status:

```typescript
// Buscar dados do chamado para notificacao
const { data: chamadoCompleto } = await supabase
  .from('chamados_assistencia')
  .select('*, associado:associados(id, nome, whatsapp, telefone)')
  .eq('id', chamado.id)
  .single();

// Notificar associado
if (chamadoCompleto?.associado) {
  await supabase.functions.invoke('notificar-status-assistencia', {
    body: {
      chamado_id: chamado.id,
      status_novo: novoStatus,
      associado_id: chamadoCompleto.associado.id,
    },
  });
}
```

### Fase 5: Enviar Contato Automaticamente

**Modificar:** `notificar-status-assistencia`

Quando status for `prestador_a_caminho`:

```typescript
if (novoStatus === 'prestador_a_caminho' && chamado.prestador_nome && chamado.prestador_telefone) {
  // Enviar cartao de contato
  await supabase.functions.invoke('whatsapp-send-contact', {
    body: {
      telefone: associadoTelefone,
      contato: {
        fullName: chamado.prestador_nome,
        phoneNumber: chamado.prestador_telefone,
        organization: 'Prestador PRATICCAR',
      },
      referencia_tipo: 'chamado_assistencia',
      referencia_id: chamado.id,
    },
  });
}
```

### Fase 6: Pesquisa de Satisfacao na Conclusao

**Criar rota publica:** `/avaliar/assistencia/:chamado_id`

**Modificar template de conclusao:**

```typescript
concluido: {
  titulo: '✅ Atendimento Concluído!',
  mensagem: `Seu chamado {protocolo} foi concluído com sucesso!

Como foi o atendimento do prestador {prestador_nome}?

⭐ Avalie agora: {link_avaliacao}

Sua opinião é muito importante para nós!`,
}
```

O link seria: `https://pratic-connect-21.lovable.app/avaliar/assistencia/{chamado_id}`

---

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/criar-chamado-assistencia/index.ts` | Adicionar envio de WhatsApp para associado na abertura |
| `src/components/assistencia/AtribuirPrestadorModal.tsx` | Chamar `notificar-cliente` ao acionar prestador |
| `src/components/assistencia/AtualizarStatusChamadoModal.tsx` | Chamar notificacao ao mudar status |
| `supabase/functions/disparar-notificacao/index.ts` | Adicionar templates completos de assistencia |

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/notificar-status-assistencia/index.ts` | Edge function dedicada para notificacoes de status |
| `src/pages/avaliar/AvaliarAssistencia.tsx` | Pagina publica para avaliar atendimento |

---

## Templates de WhatsApp Necessarios

| Template | Momento | Conteudo |
|----------|---------|----------|
| `assistencia_aberto` | Abertura | Protocolo, tipo, previsao |
| `assistencia_prestador_acionado` | Prestador selecionado | Nome, previsao |
| `assistencia_prestador_caminho` | Status = a_caminho | Nome, telefone, enviar contato |
| `assistencia_em_atendimento` | Status = em_atendimento | Confirmacao |
| `assistencia_concluido` | Status = concluido | Agradecimento + link avaliacao |
| `assistencia_cancelado` | Status = cancelado | Motivo |

---

## Fluxo de Notificacoes Proposto

```
1. Associado abre chamado (App ou WhatsApp)
   └── WhatsApp: "✅ Chamado registrado! Protocolo: ASS-..."

2. Atendente aciona prestador
   └── WhatsApp: "🚗 Prestador X foi acionado. Previsão: 30-45min"

3. Prestador aceita e parte
   └── WhatsApp: "🚚 Prestador a caminho!"
   └── WhatsApp: [Cartao de Contato do Prestador]

4. Prestador chega ao local
   └── WhatsApp: "🔧 Atendimento iniciado"

5. Atendimento concluido
   └── WhatsApp: "✅ Concluído! Avalie: [link]"
```

---

## Checklist Pos-Implementacao

- [ ] Associado recebe WhatsApp ao abrir chamado
- [ ] Associado recebe WhatsApp quando prestador e acionado
- [ ] Associado recebe WhatsApp e contato quando prestador esta a caminho
- [ ] Associado recebe WhatsApp quando atendimento inicia
- [ ] Associado recebe WhatsApp com link de avaliacao quando concluido
- [ ] Abertura de chamado via WhatsApp cria registro diretamente (sem aprovacao)
- [ ] Localizacao do associado e capturada e usada
- [ ] Contato do prestador e enviado automaticamente
- [ ] Historico completo mantido

---

## Testes Recomendados

### Teste 1: Abertura de Chamado via App

1. Acessar app do associado
2. Solicitar assistencia (guincho)
3. Verificar:
   - Chamado criado com protocolo
   - Associado recebe WhatsApp de confirmacao
   - Central recebe notificacao

### Teste 2: Fluxo Completo

1. Abrir chamado
2. Acionar prestador
3. Mudar status para "a caminho"
4. Mudar status para "em atendimento"
5. Concluir chamado
6. Verificar: Associado recebeu 5 mensagens + contato do prestador

### Teste 3: Abertura via WhatsApp

1. Enviar mensagem: "Preciso de um guincho"
2. Fornecer localizacao
3. Verificar:
   - Solicitacao criada em `chat_solicitacoes_ia`
   - Diretor recebe alerta
   - Apos aprovacao, chamado e criado
