

# Agendar Mensagem 15min Apos Aprovacao do Sinistro — Pecas em Cotacao

## O que sera feito

Adicionar no Edge Function `aprovar-sinistro` o agendamento de uma mensagem WhatsApp para 15 minutos apos a aprovacao, informando ao associado que as pecas necessarias ja estao em fase de cotacao com os auto centers parceiros. A mensagem sera processada automaticamente pelo cron `cron-contato-sinistro` que ja existe.

## Mecanismo

O sistema ja possui a infraestrutura de mensagens agendadas:
- Tabela `sinistro_contatos_agendados` armazena mensagens com horario futuro
- O cron `cron-contato-sinistro` roda a cada minuto e envia as mensagens cujo `agendado_para` ja passou
- O mesmo padrao ja e usado em `gerar-os-cotacao-aprovada` (mensagem 15min apos OS criada)

## Alteracao

### Arquivo: `supabase/functions/aprovar-sinistro/index.ts`

**Adicionar insert na tabela `sinistro_contatos_agendados` apos o envio do WhatsApp de aprovacao (apos linha 190):**

- Tipo: `pos_aprovacao_cotacao`
- Agendado para: `now() + 15 minutos`
- Mensagem com tom acolhedor informando que:
  - As pecas necessarias para o reparo ja estao sendo cotadas
  - A equipe esta em contato com auto centers parceiros
  - O associado sera informado sobre cada etapa

Mensagem proposta:

```
{nome}, aqui e a equipe Pratic Car novamente!

Enquanto aguardamos a assinatura do termo e o pagamento da cota, ja estamos adiantando o processo.

As pecas necessarias para o reparo do seu veiculo {placa} ja estao em fase de cotacao com nossos auto centers parceiros.

Nosso objetivo e agilizar ao maximo para que, assim que tudo estiver regularizado, o reparo comece o mais rapido possivel!

Voce sera informado sobre cada etapa. Qualquer duvida, estamos aqui!

ABP PraticCar
```

## Detalhes tecnicos

```typescript
// Apos o envio do WhatsApp de aprovacao (linha ~190)
if (telefone) {
  const primeiroNome = (sinistro.associado as any)?.nome?.split(' ')[0] || 'Associado';
  const placa = (sinistro.veiculo as any)?.placa || '';
  const agendadoPara = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const mensagem15 = `${primeiroNome}, aqui é a equipe Pratic Car novamente! 😊\n\nEnquanto aguardamos a assinatura do termo e o pagamento da cota, já estamos adiantando o processo! 🚀\n\n🔧 As peças necessárias para o reparo do seu veículo ${placa} já estão em *fase de cotação* com nossos auto centers parceiros.\n\nNosso objetivo é agilizar ao máximo para que, assim que tudo estiver regularizado, o reparo comece o mais rápido possível! ⚡\n\nVocê será informado sobre cada etapa. Qualquer dúvida, estamos aqui! 💙\n\nABP PraticCar`;

  try {
    await supabase.from('sinistro_contatos_agendados').insert({
      sinistro_id,
      tipo: 'pos_aprovacao_cotacao',
      telefone: telefone.replace(/\D/g, ''),
      agendado_para: agendadoPara,
      mensagem_enviada: mensagem15,
      status: 'agendado',
    });
  } catch (e) {
    console.error('[aprovar-sinistro] Erro ao agendar mensagem 15min:', e);
  }
}
```

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/aprovar-sinistro/index.ts` | Adicionar agendamento de mensagem 15min apos aprovacao informando sobre cotacao de pecas |

