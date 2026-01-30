
## Plano: IA Notificar Associado ao Criar Sinistro (App ou Painel)

### Problema Identificado

Atualmente a notificação de sinistro via WhatsApp usa um template básico que não mostra informações importantes:

**Template atual:**
```
✅ Sinistro Registrado
Seu sinistro foi registrado com sucesso!
📋 Protocolo: SIN-20260130-0001
⏰ Próximos passos: ...
```

**Faltam:**
- Dados do veículo (placa, marca, modelo)
- Tipo de evento (colisão, roubo, furto, etc.)
- Local do evento (cidade/estado)
- Data do evento

Além disso, o modal do painel admin (`NovoSinistroModal.tsx`) cria sinistros direto no banco **sem enviar WhatsApp**.

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/notificar-sinistro/index.ts` | Melhorar template `comunicado` com dados do veículo, evento e local |
| `src/components/eventos/NovoSinistroModal.tsx` | Chamar `notificar-sinistro` após criar sinistro pelo painel |

### Alterações Detalhadas

#### 1. Melhorar Template `comunicado` (`notificar-sinistro/index.ts`)

**Mudança:** Buscar dados do veículo e do sinistro para incluir na mensagem.

```typescript
// Linha 101-123: Expandir select do sinistro para incluir dados completos
const { data: sinistro, error: sinistroError } = await supabase
  .from('sinistros')
  .select(`
    id, protocolo, tipo, status, valor_indenizacao, tipo_dano, parecer,
    data_ocorrencia, local_ocorrencia, cidade_ocorrencia, estado_ocorrencia,
    associado_id,
    associados:associado_id (id, nome, user_id, email, telefone, whatsapp),
    veiculos:veiculo_id (id, placa, marca, modelo, ano_modelo)
  `)
  .eq('id', sinistro_id)
  .single();
```

**Mudança:** Atualizar template `comunicado` para usar dados completos:

```typescript
comunicado: {
  titulo: '✅ Sinistro Registrado',
  mensagem: (protocolo, extras) => {
    const tipoLabel = extras?.tipo_label || 'Sinistro';
    const veiculo = extras?.veiculo;
    const dataEvento = extras?.data_ocorrencia 
      ? new Date(extras.data_ocorrencia).toLocaleDateString('pt-BR') 
      : '';
    const local = [extras?.cidade_ocorrencia, extras?.estado_ocorrencia]
      .filter(Boolean).join('/') || 'Local não informado';
    
    let msg = `Olá! Recebemos sua comunicação de sinistro e nossa equipe já está analisando.

📋 *Protocolo:* ${protocolo}
📌 *Tipo:* ${tipoLabel}`;

    if (veiculo) {
      msg += `

🚗 *Veículo:*
${veiculo.placa} - ${veiculo.marca} ${veiculo.modelo}`;
    }
    
    msg += `

📍 *Local:* ${local}`;
    
    if (dataEvento) {
      msg += `
📅 *Data do evento:* ${dataEvento}`;
    }
    
    msg += `

⏰ *Próximos passos:*
1. Analisaremos em até 24h úteis
2. Se necessário, solicitaremos documentos
3. Acompanhe pelo app ou aqui no WhatsApp

Em breve um analista entrará em contato. Fique tranquilo! 💙`;
    
    return msg;
  },
},
```

**Mudança:** Passar dados extras para o template:

```typescript
// Antes de obter template, preparar dados extras
const veiculo = sinistro.veiculos as any;
const tipoLabels: Record<string, string> = {
  colisao: 'Colisão', roubo: 'Roubo', furto: 'Furto',
  incendio: 'Incêndio', fenomeno_natural: 'Fenômeno Natural',
  vidros: 'Vidros', vandalismo: 'Vandalismo', terceiros: 'Terceiros', outro: 'Outro'
};

const extrasParaTemplate = {
  ...dados_extras,
  valor_indenizacao: sinistro.valor_indenizacao,
  tipo_dano: sinistro.tipo_dano,
  parecer: sinistro.parecer,
  // Novos campos
  tipo_label: tipoLabels[sinistro.tipo] || sinistro.tipo,
  veiculo: veiculo,
  data_ocorrencia: sinistro.data_ocorrencia,
  local_ocorrencia: sinistro.local_ocorrencia,
  cidade_ocorrencia: sinistro.cidade_ocorrencia,
  estado_ocorrencia: sinistro.estado_ocorrencia,
};
```

#### 2. Adicionar Notificação no Painel Admin (`NovoSinistroModal.tsx`)

**Mudança:** Após criar sinistro, invocar `notificar-sinistro`:

```typescript
// Após linha 172 (depois de inserir no histórico)
// Notificar via WhatsApp
try {
  await supabase.functions.invoke('notificar-sinistro', {
    body: {
      sinistro_id: sinistro.id,
      status: 'comunicado',
    }
  });
  console.log('[NovoSinistroModal] Notificação enviada via WhatsApp');
} catch (notifError) {
  console.warn('[NovoSinistroModal] Erro ao notificar (não bloqueante):', notifError);
  // Não bloqueia - sinistro foi criado
}

return sinistro;
```

### Exemplo de Mensagem Melhorada

```
*✅ Sinistro Registrado*

Olá! Recebemos sua comunicação de sinistro e nossa equipe já está analisando.

📋 *Protocolo:* SIN-20260130-0001
📌 *Tipo:* Roubo

🚗 *Veículo:*
LTB4J74 - Fiat Mobi

📍 *Local:* São Paulo/SP
📅 *Data do evento:* 30/01/2026

⏰ *Próximos passos:*
1. Analisaremos em até 24h úteis
2. Se necessário, solicitaremos documentos
3. Acompanhe pelo app ou aqui no WhatsApp

Em breve um analista entrará em contato. Fique tranquilo! 💙
```

### Fluxo Esperado

```text
SINISTRO CRIADO (App ou Painel)
          |
          v
    notificar-sinistro(status='comunicado')
          |
          v
    Buscar dados completos:
    - Sinistro (tipo, local, data)
    - Veículo (placa, marca, modelo)
    - Associado (whatsapp)
          |
          v
    Montar mensagem personalizada
          |
          v
    Enviar via WhatsApp:
    "📋 Protocolo: SIN-...
     🚗 Veículo: LTB4J74 - Fiat Mobi
     📍 Local: São Paulo/SP
     Em breve um analista entrará em contato..."
```

### Resumo das Mudanças

1. **Template melhorado:** Inclui veículo, tipo de evento, local e data
2. **Painel notifica:** Modal do admin agora envia WhatsApp igual ao app
3. **Mensagem humanizada:** "Em breve um analista entrará em contato"
