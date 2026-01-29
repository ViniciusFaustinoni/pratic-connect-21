
# Revisao Completa - WhatsApp via Evolution API no Modulo de Cobranca

## Resumo Executivo

| Momento do Fluxo | Status WhatsApp | Implementacao Atual |
|------------------|-----------------|---------------------|
| 1. Fatura gerada - envio do PIX | **PARCIAL** | Fatura gerada, mas **NAO envia PIX automaticamente** |
| 2. 3 dias antes do vencimento - lembrete | **OK** | `enviar-lembretes-vencimento` funciona com D-3, D-1, D-0 |
| 3. No dia do vencimento - lembrete urgente | **OK** | Mensagem diferenciada para D-0 |
| 4. 1 dia apos vencimento - aviso de atraso | **NAO IMPLEMENTADO** | Funcao so processa D-3, D-1, D-0 e vencidas antigas |
| 5. 7 dias apos vencimento - notificacao de suspensao | **PARCIAL** | `cron-suspender-inadimplentes` suspende, mas mensagem WhatsApp usa `disparar-notificacao` (template inexistente) |
| 6. Pagamento confirmado - agradecimento | **PARCIAL** | `asaas-webhook` usa `disparar-notificacao` com template `boleto/pago` que funciona |
| 7. Renegociacao - proposta de acordo | **NAO IMPLEMENTADO** | Acordos criados localmente, sem notificacao WhatsApp |
| Codigo PIX copia-e-cola enviado | **OK** | Lembretes incluem PIX quando disponivel |
| Mensagens respeitam horarios comerciais | **NAO IMPLEMENTADO** | Sem verificacao de horario antes do envio |
| Tom adequado a cada etapa | **PARCIAL** | Mensagens diferenciadas, mas faltam ajustes |

---

## Analise Detalhada

### 1. Fatura Gerada - Envio do PIX - PARCIAL

**Situacao atual:** `gerar-cobrancas-mensais/index.ts`

Quando fatura e gerada:
- Cria cobranca no ASAAS
- Salva boleto_url, linha_digitavel
- **NAO busca PIX separadamente** (comentario na linha 176: "PIX precisa de request separado")
- **NAO envia WhatsApp** ao associado

```typescript
// Linha 176 - PIX nao e buscado
pix_copia_cola: asaasCobranca?.pixQrCodeUrl ? null : null, // PIX precisa de request separado
```

**Gap:** 
- PIX copia-e-cola NAO e populado na geracao
- Associado NAO recebe WhatsApp com PIX ao gerar fatura
- Envio de boleto e manual (via painel CobrancasList.tsx)

### 2. Lembrete 3 Dias Antes - OK

**Situacao atual:** `enviar-lembretes-vencimento/index.ts` linha 37-47

```typescript
const { diasAntecedencia = [3, 1, 0], incluirVencidas = true } = await req.json().catch(() => ({}));
// Adicionar datas de antecedência (D-3, D-1, D-0)
for (const dias of diasAntecedencia) {
  const data = new Date(hoje);
  data.setDate(data.getDate() + dias);
  datasAlvo.push(data.toISOString().split('T')[0]);
}
```

Mensagem para D-3 (linha 123):
```typescript
mensagem = `📋 *Lembrete de Vencimento*\n\nOlá ${associado.nome.split(' ')[0]}!\n\nSua mensalidade de *${valorFormatado}* vence em *${diasParaVencer} dias* (${dataFormatada}).\n\n`;
```

**Status:** Funcionando corretamente.

### 3. Lembrete Dia do Vencimento - OK

**Situacao atual:** `enviar-lembretes-vencimento/index.ts` linha 116-118

```typescript
case 'vence_hoje':
  mensagem = `🔔 *Lembrete de Vencimento*\n\nOlá ${associado.nome.split(' ')[0]}!\n\nSua mensalidade de *${valorFormatado}* vence *HOJE* (${dataFormatada}).\n\n`;
  break;
```

**Status:** Funcionando corretamente.

### 4. Lembrete 1 Dia Apos Vencimento - NAO IMPLEMENTADO

**Situacao atual:** A funcao `enviar-lembretes-vencimento` processa apenas:
- D-3, D-1, D-0 (configuravel)
- Cobranças ja vencidas (tipo 'vencido')

Porem, a busca no banco usa `lembrete_vencimento_enviado = false`:
```typescript
.eq('lembrete_vencimento_enviado', false);
```

Isso significa que apos enviar o primeiro lembrete (D-3), a flag e marcada como `true` e a cobranca NAO recebe mais lembretes.

**Gap:** NAO existe lembrete especifico para D+1 (primeiro dia de atraso).

### 5. Notificacao de Suspensao (7 dias) - PARCIAL

**Situacao atual:** `cron-suspender-inadimplentes/index.ts` linha 181-197

Quando suspende o associado, tenta enviar notificacao:
```typescript
await supabase.functions.invoke('disparar-notificacao', {
  body: {
    tipo: 'cobranca',
    subtipo: 'suspensao',
    dados: { ... },
  },
});
```

**Problema:** O template `cobranca/suspensao` NAO EXISTE em `disparar-notificacao/index.ts`.

Templates existentes em `disparar-notificacao`:
```typescript
boleto: {
  gerado: { ... },
  vencendo_3d: { ... },
  vencendo_1d: { ... },
  vencido: { ... },
  pago: { ... }
}
```

**Nao existe `cobranca` nem `suspensao`!**

**Gap:** Notificacao de suspensao NAO e enviada por WhatsApp - template inexistente.

### 6. Pagamento Confirmado - PARCIAL

**Situacao atual:** `asaas-webhook/index.ts` linha 355-371

Quando pagamento e confirmado:
```typescript
await supabase.functions.invoke('disparar-notificacao', {
  body: {
    tipo: 'boleto',
    subtipo: 'pago',
    dados: { valor, mes },
  }
});
```

Template existe em `disparar-notificacao`:
```typescript
pago: {
  titulo: 'Pagamento Confirmado ✓',
  mensagem: 'Pagamento de R$ {valor} confirmado. Obrigado!',
  prioridade: 'normal'
}
```

**Status:** Funciona, mas a mensagem e bem basica. Poderia incluir:
- Agradecimento mais elaborado
- Proxima data de vencimento
- Link para acessar o app

### 7. Renegociacao/Acordo - NAO IMPLEMENTADO

**Situacao atual:** `useAcordos.ts`

Quando acordo e criado:
- Insere na tabela `acordos`
- Cria parcelas
- Toast local: "Acordo criado com sucesso!"
- **NAO envia WhatsApp**

```typescript
onSuccess: () => {
  toast.success('Acordo criado com sucesso!');
  queryClient.invalidateQueries({ queryKey: ['acordos'] });
}
```

**Gap:** Associado NAO recebe notificacao quando acordo e proposto/criado.

---

## Codigo PIX Copia-e-Cola - PARCIAL

**Situacao atual:** `enviar-lembretes-vencimento/index.ts` linha 127-132

```typescript
if (cobranca.pix_copia_cola) {
  mensagem += `💠 *PIX Copia e Cola:*\n\`${cobranca.pix_copia_cola}\`\n\n`;
}
```

**Problema:** O PIX so e incluido SE estiver populado na tabela. E na geracao (`gerar-cobrancas-mensais`), o PIX NAO e buscado.

Para popular o PIX, seria necessario:
1. Apos criar cobranca no ASAAS, fazer request para endpoint `/payments/{id}/pixQrCode`
2. Salvar `payload` (codigo copia-e-cola) e `encodedImage` (QRCode)

**Gap:** PIX frequentemente nao esta disponivel porque nao e buscado na geracao.

---

## Horarios Comerciais - NAO IMPLEMENTADO

**Situacao atual:** Nenhuma funcao verifica horario antes de enviar.

Mensagens podem ser enviadas a qualquer hora do dia/noite, o que:
- E invasivo para o associado
- Pode violar regras do WhatsApp Business
- Reduz taxa de leitura

**Horarios ideais:**
- Segunda a Sexta: 8h - 20h
- Sabado: 9h - 14h
- Domingo/Feriados: NAO enviar

---

## Tom das Mensagens - PARCIAL

| Situacao | Tom Atual | Tom Ideal |
|----------|-----------|-----------|
| Lembrete D-3 | Neutro informativo | Amigavel com sugestao de evitar esquecimento |
| Lembrete D-0 | Urgente mas generico | Urgente com facilidade de pagamento (PIX) |
| D+1 (atraso) | NAO EXISTE | Gentil, lembrando do atraso e oferecendo ajuda |
| D+7 (suspensao) | NAO EXISTE | Serio, informando consequencias e oferecendo acordo |
| Pagamento OK | Generico | Agradecimento caloroso, reforco de relacionamento |
| Acordo | NAO EXISTE | Empolgado, explicando beneficios do acordo |

---

## Plano de Implementacao

### Fase 1: Buscar PIX na Geracao de Cobrancas

**Modificar:** `supabase/functions/gerar-cobrancas-mensais/index.ts`

Apos criar cobranca no ASAAS, buscar PIX:

```typescript
// Apos linha 154: if (asaasResponse.ok)
if (asaasCobranca?.id) {
  // Buscar dados do PIX
  const pixResponse = await fetch(`${ASAAS_API_URL}/payments/${asaasCobranca.id}/pixQrCode`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    },
  });

  if (pixResponse.ok) {
    const pixData = await pixResponse.json();
    asaasCobranca.pixPayload = pixData.payload;
    asaasCobranca.pixQrCode = pixData.encodedImage;
  }
}
```

Atualizar insert:
```typescript
pix_copia_cola: asaasCobranca?.pixPayload || null,
pix_qrcode: asaasCobranca?.encodedImage ? `data:image/png;base64,${asaasCobranca.encodedImage}` : null,
```

### Fase 2: Enviar WhatsApp ao Gerar Fatura

**Modificar:** `supabase/functions/gerar-cobrancas-mensais/index.ts`

Apos inserir cobranca, enviar WhatsApp:

```typescript
// Enviar WhatsApp com PIX
const telefone = associado.whatsapp || associado.telefone;
if (telefone && asaasCobranca?.pixPayload) {
  const mensagem = `📄 *Nova Fatura Disponível*

Olá ${associado.nome.split(' ')[0]}!

Sua mensalidade de *${valorMensalidade.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}* está disponível.

📅 Vencimento: ${dataVencimento.toLocaleDateString('pt-BR')}

💠 *PIX Copia e Cola:*
\`${asaasCobranca.pixPayload}\`

📊 *Linha Digitável:*
${asaasCobranca.nossoNumero || ''}

Pague agora e evite atrasos!`;

  await supabase.functions.invoke('whatsapp-send-text', {
    body: {
      telefone: telefone.replace(/\D/g, ''),
      mensagem,
      delay_ms: 500,
    },
  });
}
```

### Fase 3: Adicionar Lembrete D+1 (Primeiro Dia de Atraso)

**Modificar:** `supabase/functions/enviar-lembretes-vencimento/index.ts`

Adicionar parametro para cobranças vencidas recentemente:

```typescript
const { diasAntecedencia = [3, 1, 0], diasPosVencimento = [1, 3, 5] } = await req.json().catch(() => ({}));

// Adicionar datas de atraso (D+1, D+3, D+5)
for (const dias of diasPosVencimento) {
  const data = new Date(hoje);
  data.setDate(data.getDate() - dias);
  datasAlvo.push(data.toISOString().split('T')[0]);
}
```

Nova mensagem para D+1:
```typescript
case 'vencido_1d':
  mensagem = `⚠️ *Atenção: Sua Mensalidade Venceu*

Olá ${nome}!

Sua mensalidade de *${valorFormatado}* venceu ontem (${dataFormatada}).

Pague agora para evitar multa e juros!

💠 *PIX Copia e Cola:*
\`${pix}\`

Está com dificuldades? Entre em contato conosco para negociar.`;
  break;
```

### Fase 4: Criar Template de Suspensao

**Modificar:** `supabase/functions/disparar-notificacao/index.ts`

Adicionar templates de cobranca:

```typescript
cobranca: {
  aviso_atraso: {
    titulo: '⚠️ Cobrança em Atraso',
    mensagem: 'Olá! Sua mensalidade de R$ {valor} está em atraso há {dias_atraso} dias. Regularize para evitar suspensão.',
    prioridade: 'alta'
  },
  suspensao_iminente: {
    titulo: '🚨 Suspensão em 48h',
    mensagem: 'ATENÇÃO: Sua conta será suspensa em 48h por inadimplência. Valor pendente: R$ {valor}. Regularize agora!',
    prioridade: 'urgente'
  },
  suspensao: {
    titulo: '❌ Conta Suspensa',
    mensagem: 'Sua conta foi suspensa por inadimplência. Valor pendente: R$ {valor}. Regularize para reativar sua proteção.',
    prioridade: 'urgente'
  },
  acordo_criado: {
    titulo: '🤝 Acordo Disponível!',
    mensagem: 'Boa notícia! Seu acordo de R$ {valor_acordo} em {parcelas}x de R$ {valor_parcela} foi criado. Primeira parcela: {data_primeira}.',
    prioridade: 'alta'
  },
  parcela_vencendo: {
    titulo: '📅 Parcela do Acordo Vence Amanhã',
    mensagem: 'Lembrete: A parcela {numero}/{total} do seu acordo vence amanhã. Valor: R$ {valor}.',
    prioridade: 'normal'
  }
}
```

### Fase 5: Notificar ao Criar Acordo

**Modificar:** `src/hooks/useAcordos.ts`

Apos criar acordo, enviar notificacao:

```typescript
// Apos linha 91: return acordo;
// Buscar dados do associado para notificacao
const { data: associadoData } = await supabase
  .from('associados')
  .select('user_id, whatsapp, telefone')
  .eq('id', dados.associado_id)
  .single();

if (associadoData) {
  await supabase.functions.invoke('disparar-notificacao', {
    body: {
      associado_id: dados.associado_id,
      tipo: 'cobranca',
      subtipo: 'acordo_criado',
      dados: {
        valor_acordo: dados.valor_acordo.toFixed(2),
        parcelas: dados.qtd_parcelas,
        valor_parcela: dados.valor_parcela.toFixed(2),
        data_primeira: new Date(dados.primeira_parcela_data).toLocaleDateString('pt-BR'),
      },
      forcar_envio: true,
    },
  });
}
```

### Fase 6: Implementar Verificacao de Horario Comercial

**Criar:** `supabase/functions/_shared/verificar-horario-comercial.ts`

```typescript
export function dentroHorarioComercial(): boolean {
  // Usar timezone de Brasilia
  const agora = new Date();
  const brasiliaOffset = -3 * 60; // UTC-3
  const localOffset = agora.getTimezoneOffset();
  const brasilia = new Date(agora.getTime() + (localOffset - brasiliaOffset) * 60 * 1000);
  
  const hora = brasilia.getHours();
  const dia = brasilia.getDay(); // 0 = Domingo, 6 = Sabado
  
  // Domingo: NAO enviar
  if (dia === 0) return false;
  
  // Sabado: 9h - 14h
  if (dia === 6) return hora >= 9 && hora < 14;
  
  // Segunda a Sexta: 8h - 20h
  return hora >= 8 && hora < 20;
}

export function proximoHorarioComercial(): Date {
  const agora = new Date();
  // Logica para calcular proximo horario comercial
  // Retorna quando a mensagem deveria ser enviada
  // ...
}
```

**Modificar:** `enviar-lembretes-vencimento/index.ts`

```typescript
import { dentroHorarioComercial } from '../_shared/verificar-horario-comercial.ts';

// No inicio do processamento:
if (!dentroHorarioComercial()) {
  console.log('[enviar-lembretes] Fora do horário comercial. Adiando envio.');
  return new Response(
    JSON.stringify({ 
      success: true, 
      adiado: true, 
      mensagem: 'Fora do horário comercial' 
    }),
    { headers: corsHeaders }
  );
}
```

### Fase 7: Melhorar Tom das Mensagens

**Atualizar templates em `enviar-lembretes-vencimento`:**

```typescript
// D-3: Amigavel
case 'vencimento_3d':
  mensagem = `📋 *Lembrete Amigável*

Olá ${nome}! 👋

Sua mensalidade de *${valor}* vence em 3 dias (${data}).

💡 *Dica:* Pague via PIX e libere na hora!

💠 *PIX Copia e Cola:*
\`${pix}\`

Qualquer dúvida, estamos aqui! 😊`;
  break;

// D-0: Urgente mas facilitador
case 'vence_hoje':
  mensagem = `🔔 *VENCE HOJE!*

Olá ${nome}!

Sua mensalidade de *${valor}* vence *HOJE*!

⏰ Pague agora e evite juros e multa.

💠 *PIX Instantâneo:*
\`${pix}\`

📱 Basta copiar o código acima e colar no seu banco!`;
  break;

// D+1: Gentil
case 'vencido_1d':
  mensagem = `⚠️ *Atenção: Pagamento em Atraso*

Olá ${nome}!

Sua mensalidade de *${valor}* venceu ontem (${data}).

Ainda dá tempo de regularizar sem grandes acréscimos!

💠 *PIX Copia e Cola:*
\`${pix}\`

🤝 Dificuldades? Vamos conversar! Entre em contato.`;
  break;

// D+7: Serio
case 'suspensao_iminente':
  mensagem = `🚨 *ATENÇÃO URGENTE*

Olá ${nome},

Sua mensalidade de *${valor}* está em atraso há ${dias} dias.

⚠️ *Sua proteção veicular será SUSPENSA em 48h se não for regularizada.*

Regularize agora:

💠 *PIX Copia e Cola:*
\`${pix}\`

🤝 Precisa de um acordo? Entre em contato imediatamente.`;
  break;
```

---

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/gerar-cobrancas-mensais/index.ts` | Buscar PIX + Enviar WhatsApp na geracao |
| `supabase/functions/enviar-lembretes-vencimento/index.ts` | Adicionar D+1, D+3, D+5 + verificar horario |
| `supabase/functions/disparar-notificacao/index.ts` | Adicionar templates de cobranca/suspensao/acordo |
| `src/hooks/useAcordos.ts` | Notificar ao criar acordo |
| `supabase/functions/cron-suspender-inadimplentes/index.ts` | Corrigir tipo de notificacao |

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/_shared/verificar-horario-comercial.ts` | Utilitario para verificar horario comercial |

---

## Fluxo de Notificacoes Proposto

```text
FATURA GERADA (D-X antes do vencimento)
└── WhatsApp: "📄 Nova fatura disponível! [PIX]"

D-3 (3 dias antes)
└── WhatsApp: "📋 Lembrete amigável - Vence em 3 dias [PIX]"

D-1 (1 dia antes)
└── WhatsApp: "📋 Lembrete - Vence amanhã! [PIX]"

D-0 (Dia do vencimento)
└── WhatsApp: "🔔 VENCE HOJE! [PIX]"

D+1 (1 dia de atraso)
└── WhatsApp: "⚠️ Pagamento em atraso - Regularize! [PIX]"

D+3 (3 dias de atraso)
└── WhatsApp: "⚠️ Cobrança vencida há 3 dias [PIX]"

D+5 (5 dias de atraso)
└── WhatsApp: "🚨 Suspensão em 48h - Regularize! [PIX]"

D+7 (Suspensao)
└── WhatsApp: "❌ Conta suspensa por inadimplência"

PAGAMENTO CONFIRMADO
└── WhatsApp: "✅ Pagamento confirmado! Obrigado!"

ACORDO CRIADO
└── WhatsApp: "🤝 Acordo disponível! Xp de R$ Y"

PARCELA ACORDO VENCENDO
└── WhatsApp: "📅 Parcela X/Y vence amanhã"
```

---

## Horarios de Envio (Recomendado)

| Tipo de Mensagem | Horario Ideal |
|------------------|---------------|
| Nova fatura | 9h - 11h (Terça a Quinta) |
| Lembretes D-3, D-1 | 9h - 11h |
| Lembrete D-0 | 8h - 9h (dar tempo de pagar) |
| Avisos de atraso D+1, D+3 | 10h - 12h |
| Suspensao iminente D+5 | 10h - 11h |
| Confirmacao pagamento | Imediato (qualquer hora) |
| Acordo criado | Imediato (qualquer hora) |

---

## Checklist Pos-Implementacao

- [ ] PIX e populado ao gerar cobranca
- [ ] Associado recebe WhatsApp com PIX ao gerar fatura
- [ ] Lembretes D-3, D-1, D-0 funcionando
- [ ] Lembrete D+1 (primeiro dia de atraso) funcionando
- [ ] Lembrete D+3 funcionando
- [ ] Aviso D+5 (suspensao iminente) funcionando
- [ ] Notificacao de suspensao (D+7) funcionando
- [ ] Confirmacao de pagamento com mensagem calorosa
- [ ] Notificacao ao criar acordo funcionando
- [ ] Verificacao de horario comercial ativa
- [ ] Tom das mensagens adequado a cada etapa
