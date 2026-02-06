
## Plano: Notificar Vistoriador por WhatsApp com Dados do Associado

### Contexto Atual

Quando uma vistoria é atribuída automaticamente, o sistema já:
1. ✅ Atribui o serviço ao profissional mais próximo
2. ✅ Envia **push notification** ao profissional (app)
3. ✅ Notifica o **cliente** via WhatsApp que o técnico está a caminho

**O que falta:** Enviar mensagem WhatsApp ao **vistoriador** com os dados do associado para que ele possa entrar em contato diretamente.

---

### Dados Disponíveis na Atribuição

O sistema já possui todos os dados necessários no momento da atribuição:

| Dado | Variável | Origem |
|------|----------|--------|
| Nome do cliente | `servico.associado_nome` | Tabela associados |
| Telefone/WhatsApp do cliente | `servico.associado_telefone` ou `servico.associado_whatsapp` | Tabela associados |
| Placa do veículo | `servico.veiculo_placa` | Tabela veiculos |
| Marca/Modelo | `servico.veiculo_marca` / `servico.veiculo_modelo` | Tabela veiculos |
| Endereço | `servico.logradouro`, `numero`, `bairro`, `cidade` | Tabela servicos |
| WhatsApp do profissional | `profiles.whatsapp` ou `profiles.telefone` | Tabela profiles |

---

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/atribuir-proxima-tarefa/index.ts` | Adicionar envio de WhatsApp ao vistoriador após atribuição |

---

### Alteração Proposta

Adicionar bloco de notificação WhatsApp ao vistoriador **após** a notificação ao cliente (linha ~861), para que ambos recebam a mensagem simultaneamente.

**Código a adicionar (após a linha 861):**

```typescript
// 10. NOTIFICAR VISTORIADOR via WhatsApp com dados do cliente
try {
  // Buscar telefone do profissional
  const { data: profissionalTel } = await supabase
    .from('profiles')
    .select('nome, whatsapp, telefone')
    .eq('id', profissionalId)
    .single();
  
  const telefoneProfissional = profissionalTel?.whatsapp || profissionalTel?.telefone;
  
  if (telefoneProfissional) {
    const tipoServicoLabel = servico.tipo === 'instalacao' 
      ? 'INSTALAÇÃO' 
      : 'VISTORIA';
    
    const telefoneCliente = servico.associado_whatsapp || servico.associado_telefone;
    const linkWhatsAppCliente = telefoneCliente 
      ? `https://wa.me/55${telefoneCliente.replace(/\D/g, '')}` 
      : 'Não informado';
    
    const endereco = [
      servico.logradouro,
      servico.numero,
      servico.bairro,
      servico.cidade
    ].filter(Boolean).join(', ') || 'Endereço cadastrado';
    
    const periodoLabel = servico.periodo === 'manha' 
      ? 'Manhã (08:00-12:00)' 
      : servico.periodo === 'tarde'
        ? 'Tarde (14:00-18:00)'
        : 'A definir';

    const mensagemVistoriador = `📋 *NOVA TAREFA ATRIBUÍDA*

🔧 *Tipo:* ${tipoServicoLabel}
📍 *Endereço:* ${endereco}
⏰ *Período:* ${periodoLabel}

👤 *DADOS DO CLIENTE:*
• Nome: ${servico.associado_nome || 'Não informado'}
• Telefone: ${telefoneCliente || 'Não informado'}

🚗 *VEÍCULO:*
• Placa: ${servico.veiculo_placa || 'Não informada'}
• ${servico.veiculo_marca || ''} ${servico.veiculo_modelo || ''}

📱 *Link direto para WhatsApp do cliente:*
${linkWhatsAppCliente}

⚠️ Entre em contato para confirmar sua chegada!`;

    await supabase.functions.invoke('whatsapp-send-text', {
      body: {
        telefone: telefoneProfissional.replace(/\D/g, ''),
        mensagem: mensagemVistoriador,
      },
    });
    
    console.log(`[atribuir-proxima-tarefa] ✓ Vistoriador ${profissionalId} notificado via WhatsApp`);
  } else {
    console.log(`[atribuir-proxima-tarefa] Profissional sem WhatsApp cadastrado`);
  }
} catch (vistWhatsError) {
  console.error('[atribuir-proxima-tarefa] Erro ao notificar vistoriador via WhatsApp:', vistWhatsError);
  // Não bloqueia o fluxo principal
}
```

---

### Fluxo Visual Atualizado

```
┌────────────────────────────────────────────────────────────────────┐
│              ATRIBUIÇÃO AUTOMÁTICA DE TAREFA                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  1. Sistema encontra serviço pendente mais próximo                │
│  2. Atribui ao vistoriador ativo                                  │
│  3. Atualiza status para "em_rota"                                │
│                                                                    │
│  ═══════════════ NOTIFICAÇÕES SIMULTÂNEAS ══════════════════      │
│                                                                    │
│  ┌──────────────────────┐    ┌──────────────────────┐             │
│  │  📱 PUSH (APP)        │    │  📱 PUSH (APP)       │             │
│  │  Profissional        │    │  (se houver)         │             │
│  │  "Nova Tarefa"       │    │                      │             │
│  └──────────────────────┘    └──────────────────────┘             │
│                                                                    │
│  ┌──────────────────────┐    ┌──────────────────────┐             │
│  │ 💬 WHATSAPP CLIENTE   │    │ 💬 WHATSAPP VISTORIADOR │ ← NOVO │
│  │ "Técnico a caminho"  │    │ "Nova tarefa atribuída"│          │
│  │ Nome do técnico      │    │ Nome/telefone cliente │          │
│  │ Endereço             │    │ Endereço              │          │
│  │ Período              │    │ Veículo               │          │
│  │                      │    │ Link WhatsApp cliente │          │
│  └──────────────────────┘    └──────────────────────┘             │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

### Exemplo de Mensagem ao Vistoriador

```
📋 *NOVA TAREFA ATRIBUÍDA*

🔧 *Tipo:* VISTORIA
📍 *Endereço:* Rua das Flores, 123, Centro, Fortaleza
⏰ *Período:* Manhã (08:00-12:00)

👤 *DADOS DO CLIENTE:*
• Nome: João Silva
• Telefone: (85) 99999-1234

🚗 *VEÍCULO:*
• Placa: ABC-1234
• Toyota Corolla

📱 *Link direto para WhatsApp do cliente:*
https://wa.me/5585999991234

⚠️ Entre em contato para confirmar sua chegada!
```

---

### Benefícios

| Benefício | Descrição |
|-----------|-----------|
| **Comunicação direta** | Vistoriador pode confirmar chegada via WhatsApp pessoal |
| **Dados completos** | Nome, telefone, endereço e veículo na mesma mensagem |
| **Link clicável** | Um toque para abrir conversa com o cliente |
| **Independência** | Funciona mesmo sem internet no app (usa WhatsApp pessoal) |

---

### Pré-requisitos

Para funcionar corretamente, é necessário:
1. ✅ Vistoriador ter campo `whatsapp` ou `telefone` preenchido na tabela `profiles`
2. ✅ Instância WhatsApp conectada (Evolution API)
3. ✅ Edge Function `whatsapp-send-text` funcionando

---

### Resultado Esperado

| Cenário | Comportamento |
|---------|---------------|
| Tarefa atribuída | Vistoriador recebe WhatsApp com dados do cliente |
| Profissional sem WhatsApp | Log de aviso, não bloqueia o fluxo |
| Erro no envio | Log de erro, tarefa continua atribuída normalmente |
| Cliente sem telefone | Campo mostra "Não informado" |
