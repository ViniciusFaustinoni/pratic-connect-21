
# Plano: Autorização de Diretores, Blacklist em Reprovação de Analista e Contato do Vistoriador

## Resumo das Solicitações

1. **Diretor pode remover veículos/associados da blacklist e reverter recusas**
2. **Reprovação por analista de cadastro adiciona veículo à blacklist** (tipo `proposta_reprovada`)
3. **Incluir contato do vistoriador na mensagem enviada ao associado** quando a tarefa é atribuída

---

## Análise do Cenário Atual

### Item 1: Remoção da Blacklist
- A página `Blacklist.tsx` (linhas 50-51) já verifica permissão:
  ```typescript
  const { isDiretor, isDesenvolvedor, isAdminMaster } = usePermissions();
  const canManageBlacklist = isDiretor || isDesenvolvedor || isAdminMaster;
  ```
- O hook `useRemoverBlacklist` já permite soft delete (marca como `ativo: false`)
- **OK** - Diretores já podem remover da blacklist

### Item 2: Reprovação por Analista de Cadastro
- O hook `useReprovarProposta` (linhas 1864-1924) **NÃO** insere na blacklist
- Apenas atualiza contrato para `cancelado` e associado para `reprovado`
- **FALTANDO** - Precisa adicionar inserção na blacklist com `tipo_reprovacao: 'proposta_reprovada'`

### Item 3: Contato do Vistoriador na Mensagem
- Template `tecnico_em_rota` na função `notificar-cliente` (linhas 115-125):
  ```
  👤 *Técnico:* {tecnico_nome}
  📍 *Endereço:* {endereco}
  ```
- **FALTANDO** - Não inclui telefone/WhatsApp do técnico para o cliente entrar em contato

---

## Solução Proposta

### 1. Diretores Revertem Recusas de Veículos

Adicionar funcionalidade para reverter status do veículo quando removido da blacklist:

**Arquivo:** `src/pages/diretoria/Blacklist.tsx`

- Adicionar dialog de confirmação com opção de reverter status do veículo
- Ao confirmar, além de desativar o registro da blacklist:
  - Atualizar `veiculos.status` de `'recusado'` para `'em_analise'`
  - Opcionalmente reativar o associado (de `'suspenso'` para `'pendente_vistoria'`)

**Arquivo:** `src/hooks/useBlacklist.ts`

- Atualizar o hook `useRemoverBlacklist` para aceitar opção de reverter:
  ```typescript
  mutationFn: async ({ id, reverterVeiculo }: { id: string; reverterVeiculo?: boolean })
  ```

### 2. Reprovação de Analista Adiciona à Blacklist

**Arquivo:** `src/hooks/usePropostasPendentes.ts`

Modificar a função `useReprovarProposta` para:

```typescript
mutationFn: async ({ contratoId, associadoId, motivo, justificativa }: ReprovarPropostaParams) => {
  // ... código existente ...
  
  // NOVO: Buscar veículo do contrato
  const { data: veiculoData } = await supabase
    .from('veiculos')
    .select('id, placa, chassi')
    .eq('associado_id', associadoId)
    .single();

  // NOVO: Atualizar veículo para 'recusado'
  if (veiculoData?.id) {
    await supabase
      .from('veiculos')
      .update({ 
        status: 'recusado',
        motivo_recusa_veiculo: `${motivo}: ${justificativa}`,
      })
      .eq('id', veiculoData.id);
  }

  // NOVO: Adicionar veículo à blacklist
  if (veiculoData?.placa) {
    await supabase
      .from('blacklist_veiculos')
      .insert({
        placa: veiculoData.placa.toUpperCase().replace(/[^A-Z0-9]/g, ''),
        chassi: veiculoData.chassi,
        motivo: motivo,
        justificativa: justificativa,
        tipo_reprovacao: 'proposta_reprovada',
        veiculo_id: veiculoData.id,
        associado_id: associadoId,
        contrato_id: contratoId,
        adicionado_por: profile?.id,
        ativo: true,
      });
  }
  
  // ... resto do código ...
}
```

### 3. Incluir Contato do Vistoriador na Mensagem ao Cliente

**Arquivo:** `supabase/functions/notificar-cliente/index.ts`

Atualizar o template `tecnico_em_rota`:

```typescript
tecnico_em_rota: {
  titulo: '🚗 Técnico a Caminho!',
  mensagem: `Olá {nome}! Nosso técnico está a caminho do seu endereço para realizar a {tipo_servico}.

👤 *Técnico:* {tecnico_nome}
📞 *Contato:* {tecnico_telefone}
💬 *WhatsApp:* {tecnico_whatsapp_link}
📍 *Endereço:* {endereco}
⏰ *Período:* {periodo}

Você pode entrar em contato com o técnico se precisar de mais informações!`,
  emailTemplate: 'generico',
},
```

**Arquivo:** `supabase/functions/atribuir-proxima-tarefa/index.ts`

Na notificação do cliente (linhas 844-855), adicionar dados do técnico:

```typescript
// Buscar telefone do profissional para enviar ao cliente
const { data: profissionalData } = await supabase
  .from('profiles')
  .select('nome, whatsapp, telefone')
  .eq('id', profissionalId)
  .single();

const telefoneTecnico = profissionalData?.whatsapp || profissionalData?.telefone;
const whatsappLinkTecnico = telefoneTecnico 
  ? `https://wa.me/55${telefoneTecnico.replace(/\D/g, '')}` 
  : 'Não disponível';

await supabase.functions.invoke('notificar-cliente', {
  body: {
    tipo: 'tecnico_em_rota',
    associado_id: servico.associado_id,
    dados: {
      tecnico_nome: tecnicoNome,
      tecnico_telefone: telefoneTecnico || 'Não informado',
      tecnico_whatsapp_link: whatsappLinkTecnico,
      tipo_servico: tipoServicoLabel,
      endereco: endereco,
      periodo: periodoLabel,
    },
  },
});
```

**Arquivo:** `supabase/functions/notificar-inicio-rota/index.ts`

Mesma atualização na função de início de rota (linhas 125-141):

```typescript
const { error: notifyError } = await supabase.functions.invoke('notificar-cliente', {
  body: {
    tipo: 'tecnico_em_rota',
    associado_id: associado.id,
    dados: {
      tecnico_nome: profissional.nome,
      tecnico_telefone: profissional.whatsapp || profissional.telefone || 'Não informado',
      tecnico_whatsapp_link: profissional.whatsapp || profissional.telefone 
        ? `https://wa.me/55${(profissional.whatsapp || profissional.telefone).replace(/\D/g, '')}`
        : 'Não disponível',
      tipo_servico: tipoServico,
      endereco: [servico.logradouro, servico.numero, servico.bairro, servico.cidade, servico.uf]
        .filter(Boolean).join(', ')
    }
  }
});
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/usePropostasPendentes.ts` | Adicionar inserção na blacklist ao reprovar proposta |
| `src/hooks/useBlacklist.ts` | Adicionar opção de reverter status do veículo |
| `src/pages/diretoria/Blacklist.tsx` | Adicionar UI para reverter recusa ao remover |
| `supabase/functions/notificar-cliente/index.ts` | Atualizar template com contato do técnico |
| `supabase/functions/atribuir-proxima-tarefa/index.ts` | Enviar dados de contato do técnico |
| `supabase/functions/notificar-inicio-rota/index.ts` | Enviar dados de contato do técnico |

---

## Fluxo de Reprovação pelo Analista (Novo)

```text
┌─────────────────────────────────────────────────────────────┐
│  1. Analista de Cadastro reprova proposta                   │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Contrato → status = 'cancelado'                         │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Associado → status = 'reprovado'                        │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Veículo → status = 'recusado'                           │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Veículo inserido na blacklist                           │
│     com tipo_reprovacao = 'proposta_reprovada'              │
└─────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Reversão pelo Diretor

```text
┌─────────────────────────────────────────────────────────────┐
│  1. Diretor acessa Blacklist e clica em "Remover"           │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Dialog pergunta se deseja reverter status do veículo    │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Se sim: Veículo → status = 'em_analise'                 │
│             Associado → status = 'pendente_vistoria'        │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Blacklist → ativo = false                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Exemplo de Mensagem para o Cliente (Atualizada)

```
🚗 Técnico a Caminho!

Olá João! Nosso técnico está a caminho do seu endereço para realizar a vistoria.

👤 Técnico: Carlos Silva
📞 Contato: (11) 99999-9999
💬 WhatsApp: https://wa.me/5511999999999
📍 Endereço: Rua das Flores, 123, Centro, São Paulo
⏰ Período: Manhã (08:00-12:00)

Você pode entrar em contato com o técnico se precisar de mais informações!
```

---

## Testes Recomendados

1. Reprovar uma proposta como analista de cadastro e verificar se:
   - Veículo aparece na Blacklist com tipo "Proposta Reprovada"
   - Status do veículo é "recusado"

2. Como diretor, remover um veículo da blacklist e reverter:
   - Status do veículo volta para "em_analise"
   - Associado volta para status pendente

3. Atribuir uma tarefa a um vistoriador e verificar se:
   - Cliente recebe mensagem com nome E contato do técnico
   - Link de WhatsApp do técnico está funcional
