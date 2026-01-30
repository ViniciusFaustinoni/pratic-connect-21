
## Plano: Completar Notificações de Boas-Vindas e Rota do Vistoriador

### Problemas Identificados

| Item | Status | Problema |
|------|--------|----------|
| Boas-vindas Roubo/Furto | ⚠️ Parcial | Falta dados do veículo (placa, marca, modelo) |
| Cobertura Total Ativada | ✅ OK | Já implementado e envia placa |
| Vistoriador em Rota | ❌ Ausente | Cliente não é notificado quando vistoriador inicia a rota |

### Arquivos a Modificar

**1. `supabase/functions/notificar-cliente/index.ts`**
- Atualizar template `proposta_aprovada_roubo_furto` para incluir variáveis de veículo
- Adicionar novo template `tecnico_em_rota`

**2. `src/hooks/usePropostasPendentes.ts`**
- Buscar dados do veículo antes de chamar notificação
- Passar placa, marca, modelo no objeto `dados`

**3. `supabase/functions/atribuir-proxima-tarefa/index.ts`**
- Após atribuir tarefa e mudar status para `em_rota`, notificar cliente via WhatsApp

### Alterações Detalhadas

#### 1. Atualizar Template de Boas-Vindas (`notificar-cliente/index.ts`)

```typescript
proposta_aprovada_roubo_furto: {
  titulo: '🎉 Bem-vindo à PRATIC!',
  mensagem: `Parabéns {nome}! Seu cadastro foi aprovado! 🚗

📋 *Veículo Protegido:*
{placa} - {marca} {modelo}

🛡️ *Cobertura Ativa:* Roubo e Furto
⏳ *Próximo Passo:* Instalação do rastreador

📱 Acesse o link abaixo para criar sua conta no app PRATIC:
🔗 {link_acompanhamento}

Após a instalação, sua *Cobertura Total* será ativada automaticamente!

Bem-vindo à família PRATIC! 💙`,
  emailTemplate: 'generico',
},
```

#### 2. Adicionar Template Técnico em Rota (`notificar-cliente/index.ts`)

```typescript
tecnico_em_rota: {
  titulo: '🚗 Técnico a Caminho!',
  mensagem: `Olá {nome}! Nosso técnico está a caminho do seu endereço para realizar a {tipo_servico}.

👤 *Técnico:* {tecnico_nome}
📍 *Endereço:* {endereco}
⏰ *Período:* {periodo}

Aguarde no local combinado. Qualquer dúvida, responda esta mensagem!`,
  emailTemplate: 'generico',
},
```

#### 3. Passar Dados do Veículo na Aprovação (`usePropostasPendentes.ts`)

Linha ~1530, antes de chamar `notificar-cliente`:

```typescript
// Buscar dados do veículo para notificação
const { data: veiculoNotif } = await supabase
  .from('veiculos')
  .select('placa, marca, modelo')
  .eq('associado_id', associadoId)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

await supabase.functions.invoke('notificar-cliente', {
  body: {
    tipo: 'proposta_aprovada_roubo_furto',
    associado_id: associadoId,
    dados: {
      link_acompanhamento: linkAcompanhamento,
      placa: veiculoNotif?.placa || '',
      marca: veiculoNotif?.marca || '',
      modelo: veiculoNotif?.modelo || '',
    },
  },
});
```

#### 4. Notificar Cliente Quando Técnico Inicia Rota (`atribuir-proxima-tarefa/index.ts`)

Após linha ~730 (após enviar push para o profissional), adicionar:

```typescript
// 9. NOTIFICAR CLIENTE via WhatsApp que técnico está a caminho
if (servico.associado_id) {
  try {
    // Buscar nome do técnico
    const { data: profissionalData } = await supabase
      .from('profiles')
      .select('nome')
      .eq('id', profissionalId)
      .single();
    
    const tecnicoNome = profissionalData?.nome || 'Técnico PRATIC';
    const tipoServicoLabel = servico.tipo === 'instalacao' 
      ? 'instalação do rastreador' 
      : 'vistoria';
    const periodoLabel = servico.periodo === 'manha' 
      ? 'Manhã (08:00-12:00)' 
      : servico.periodo === 'tarde'
        ? 'Tarde (14:00-18:00)'
        : 'A definir';
    const endereco = [
      servico.logradouro,
      servico.numero,
      servico.bairro,
      servico.cidade
    ].filter(Boolean).join(', ') || 'Endereço cadastrado';

    await supabase.functions.invoke('notificar-cliente', {
      body: {
        tipo: 'tecnico_em_rota',
        associado_id: servico.associado_id,
        dados: {
          tecnico_nome: tecnicoNome,
          tipo_servico: tipoServicoLabel,
          endereco: endereco,
          periodo: periodoLabel,
        },
      },
    });
    
    console.log(`[atribuir-proxima-tarefa] ✓ Cliente notificado sobre técnico em rota`);
  } catch (notifError) {
    console.error('[atribuir-proxima-tarefa] Erro ao notificar cliente:', notifError);
    // Não bloqueia o fluxo principal
  }
}
```

### Resumo das Mudanças

| Arquivo | Alteração |
|---------|-----------|
| `notificar-cliente/index.ts` | Melhorar template boas-vindas + novo template técnico em rota |
| `usePropostasPendentes.ts` | Buscar e passar dados do veículo na aprovação |
| `atribuir-proxima-tarefa/index.ts` | Notificar cliente quando técnico inicia rota |

### Fluxo Esperado

```text
APROVAÇÃO PROPOSTA (Roubo/Furto)
        |
        v
WhatsApp: "🎉 Bem-vindo à PRATIC!
Veículo: ABC1234 - Toyota Corolla
Cobertura: Roubo e Furto ✅
Link: [criar conta no app]"
        |
        v
(dias depois - instalação agendada)
        |
        v
VISTORIADOR INICIA ROTA
        |
        v
WhatsApp: "🚗 Técnico a Caminho!
Técnico: João Silva
Endereço: Rua X, 123 - Centro
Período: Manhã (08:00-12:00)"
        |
        v
INSTALAÇÃO CONCLUÍDA
        |
        v
WhatsApp: "🛡️ Cobertura Total Ativada!
Seu veículo ABC1234 agora tem proteção completa!"
```

### Testes Recomendados

1. Aprovar uma proposta e verificar se o WhatsApp mostra dados do veículo + link
2. Iniciar serviço como vistoriador e verificar se cliente recebe notificação de "técnico a caminho"
3. Concluir vistoria/instalação e verificar notificação de cobertura total
