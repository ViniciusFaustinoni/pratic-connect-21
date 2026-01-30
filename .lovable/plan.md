

# Plano: Compartilhamento Inteligente de Planos via WhatsApp com IA

## Resumo

Implementar uma funcionalidade aprimorada de compartilhamento de cotações via WhatsApp que:
1. Consolida **todos os planos selecionados** em uma única mensagem
2. Lista os **benefícios completos** de cada plano
3. Usa **IA (Lovable AI)** para personalizar o texto de forma mais atrativa e humanizada

## Situação Atual

A função `copiarParaWhatsApp` em `src/pages/vendas/Cotacoes.tsx` atualmente:
- Só exibe os primeiros 5 benefícios do **primeiro plano** (`cotacao.planos?.coberturas`)
- Não considera os planos de comparação salvos em `dados_extras.planos_comparacao`
- Gera um texto fixo/padronizado sem personalização

## Solução Proposta

### Arquitetura

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUXO DE COMPARTILHAMENTO                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. CLICK "Copiar para WhatsApp"                                            │
│                 ↓                                                           │
│  2. Extrair planos_comparacao do dados_extras                               │
│     (Se não houver, usar plano principal)                                   │
│                 ↓                                                           │
│  3. Montar objeto com dados estruturados                                    │
│     • Dados do cliente                                                      │
│     • Dados do veículo                                                      │
│     • Lista de planos com coberturas completas                              │
│                 ↓                                                           │
│  4. Chamar Edge Function 'gerar-mensagem-whatsapp'                          │
│     • Usa Lovable AI (Gemini) para personalizar                             │
│     • Retorna texto humanizado e atrativo                                   │
│                 ↓                                                           │
│  5. Copiar para clipboard                                                   │
│     • Toast de sucesso                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Parte 1: Edge Function para Gerar Mensagem com IA

### Nova Edge Function: `supabase/functions/gerar-mensagem-whatsapp/index.ts`

Essa função receberá os dados da cotação e usará a Lovable AI para gerar um texto personalizado.

**Payload de entrada:**
```typescript
{
  cliente: {
    nome: string;
  };
  veiculo: {
    marca: string;
    modelo: string;
    ano: number;
    placa?: string;
  };
  valorFipe: number;
  valorAdesao: number;
  validadeDias: number;
  planos: Array<{
    nome: string;
    valorMensal: number;
    coberturas: string[];
    naoInclui?: string[];
  }>;
  linkCotacao?: string;
}
```

**System Prompt para IA:**
```text
Você é um assistente de vendas da PRATICCAR que gera mensagens de WhatsApp para compartilhar cotações de proteção veicular.

REGRAS:
1. Seja amigável e profissional
2. Use emojis de forma moderada (não exagere)
3. Formate para WhatsApp (use *negrito* para destaques)
4. Liste TODOS os benefícios de cada plano
5. Quando houver múltiplos planos, apresente-os de forma comparativa
6. Inclua o link da cotação se fornecido
7. Termine com um call-to-action amigável
8. Mantenha o texto conciso mas completo

ESTRUTURA SUGERIDA:
- Saudação personalizada
- Informações do veículo
- Apresentação dos planos (com TODOS os benefícios)
- Valores destacados
- Link para ver mais detalhes (se houver)
- Call-to-action
```

## Parte 2: Atualizar Função de Copiar

### Modificar `copiarParaWhatsApp` em `src/pages/vendas/Cotacoes.tsx`

**Antes (código atual):**
```typescript
const copiarParaWhatsApp = async (cotacao: CotacaoWithRelations) => {
  const coberturas = cotacao.planos?.coberturas as string[] | undefined;
  const beneficiosTexto = coberturas?.slice(0, 5).map(c => `✓ ${c}`).join('\n') || '✓ Proteção completa';
  
  const mensagem = `Olá! 🚗\n\n...`; // Texto fixo
  await navigator.clipboard.writeText(mensagem);
};
```

**Depois (nova implementação):**
```typescript
const copiarParaWhatsApp = async (cotacao: CotacaoWithRelations) => {
  // 1. Extrair planos de dados_extras ou usar plano principal
  const planosComparacao = cotacao.dados_extras?.planos_comparacao;
  
  let planos: Array<{ nome: string; valorMensal: number; coberturas: string[]; naoInclui?: string[] }> = [];
  
  if (planosComparacao && planosComparacao.length > 0) {
    planos = planosComparacao.map(p => ({
      nome: p.nome,
      valorMensal: p.valorMensal,
      coberturas: p.coberturas || [],
      naoInclui: p.naoInclui || [],
    }));
  } else if (cotacao.planos) {
    planos = [{
      nome: cotacao.planos.nome,
      valorMensal: cotacao.valor_total_mensal || 0,
      coberturas: (cotacao.planos.coberturas as string[]) || [],
    }];
  }
  
  // 2. Montar dados para a IA
  const dadosCotacao = {
    cliente: { nome: cotacao.leads?.nome || cotacao.nome_solicitante || 'Cliente' },
    veiculo: {
      marca: cotacao.veiculo_marca || '',
      modelo: cotacao.veiculo_modelo || '',
      ano: cotacao.veiculo_ano || 0,
      placa: cotacao.veiculo_placa,
    },
    valorFipe: cotacao.valor_fipe || 0,
    valorAdesao: cotacao.valor_adesao || 0,
    validadeDias: cotacao.validade_dias || 7,
    planos,
    linkCotacao: cotacao.token_publico 
      ? `${window.location.origin}/cotacao/${cotacao.token_publico}` 
      : undefined,
  };
  
  // 3. Chamar Edge Function com IA
  setCopiandoWhatsApp(true);
  try {
    const { data, error } = await supabase.functions.invoke('gerar-mensagem-whatsapp', {
      body: dadosCotacao,
    });
    
    if (error) throw error;
    
    await navigator.clipboard.writeText(data.mensagem);
    toast.success('Mensagem copiada! Cole no WhatsApp.');
  } catch (error) {
    // Fallback: usar mensagem padrão se IA falhar
    const mensagemFallback = gerarMensagemFallback(cotacao, planos);
    await navigator.clipboard.writeText(mensagemFallback);
    toast.success('Mensagem copiada!');
  } finally {
    setCopiandoWhatsApp(false);
  }
};
```

## Parte 3: Fallback sem IA

Caso a IA falhe ou demore, ter uma função de fallback que gera a mensagem localmente:

```typescript
function gerarMensagemFallback(
  cotacao: CotacaoWithRelations,
  planos: Array<{ nome: string; valorMensal: number; coberturas: string[] }>
): string {
  const nomeCliente = cotacao.leads?.nome || cotacao.nome_solicitante || '';
  const veiculo = `${cotacao.veiculo_marca} ${cotacao.veiculo_modelo} ${cotacao.veiculo_ano}`;
  
  let mensagem = `Olá${nomeCliente ? ` ${nomeCliente.split(' ')[0]}` : ''}! 🚗\n\n`;
  mensagem += `Preparamos uma cotação especial para seu *${veiculo}*.\n\n`;
  mensagem += `💰 *Valor FIPE:* R$ ${cotacao.valor_fipe?.toLocaleString('pt-BR')}\n\n`;
  
  // Listar cada plano com TODOS os benefícios
  planos.forEach((plano, index) => {
    if (planos.length > 1) {
      mensagem += `━━━━━━━━━━━━━━━━━━\n`;
      mensagem += `📦 *OPÇÃO ${index + 1}: ${plano.nome}*\n`;
    } else {
      mensagem += `📦 *Plano:* ${plano.nome}\n`;
    }
    mensagem += `💵 *Mensalidade:* R$ ${plano.valorMensal.toFixed(2)}/mês\n\n`;
    
    if (plano.coberturas.length > 0) {
      mensagem += `✅ *Benefícios inclusos:*\n`;
      plano.coberturas.forEach(c => {
        mensagem += `✓ ${c}\n`;
      });
      mensagem += `\n`;
    }
  });
  
  mensagem += `📝 *Taxa de Adesão:* R$ ${cotacao.valor_adesao?.toFixed(2)}\n`;
  mensagem += `⏰ Cotação válida por ${cotacao.validade_dias || 7} dias.\n\n`;
  
  if (cotacao.token_publico) {
    mensagem += `🔗 Veja mais detalhes:\n`;
    mensagem += `${window.location.origin}/cotacao/${cotacao.token_publico}\n\n`;
  }
  
  mensagem += `Posso te ajudar com mais alguma informação? 😊`;
  
  return mensagem;
}
```

## Parte 4: UI Feedback durante Geração

Adicionar estado de loading e feedback visual enquanto a IA gera a mensagem:

```tsx
// Novo estado
const [copiandoWhatsApp, setCopiandoWhatsApp] = useState(false);

// No botão
<Button
  size="sm"
  className="bg-green-600 hover:bg-green-700 text-white"
  onClick={() => onCopiarWhatsApp(cotacao)}
  disabled={copiandoWhatsApp}
>
  {copiandoWhatsApp ? (
    <>
      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      Gerando...
    </>
  ) : (
    <>
      <ClipboardCopy className="h-4 w-4 mr-1" />
      Copiar para WhatsApp
    </>
  )}
</Button>
```

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/gerar-mensagem-whatsapp/index.ts` | Edge Function com IA |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/vendas/Cotacoes.tsx` | Atualizar `copiarParaWhatsApp`, adicionar estado de loading |
| `src/components/cotacoes/CotacaoCard.tsx` | Passar estado de loading para o botão |

## Exemplo de Saída da IA

Para uma cotação com 2 planos (SELECT EXCLUSIVE e SELECT ONE):

```text
Olá João! 🚗

Preparei uma cotação especial para o seu *Volkswagen Voyage 2018*!

💰 *Valor FIPE:* R$ 48.336,00

━━━━━━━━━━━━━━━━━━
📦 *OPÇÃO 1: SELECT EXCLUSIVE APLICATIVO*
💵 *R$ 166,00/mês*

✅ *O que está incluso:*
✓ Proteção contra Roubo e Furto (100% FIPE)
✓ Proteção contra Colisão
✓ Proteção contra Incêndio
✓ Proteção contra Fenômenos da Natureza
✓ Assistência 24h com Guincho (500km)
✓ Chaveiro e Socorro Elétrico
✓ Rastreamento em tempo real via App
✓ Proteção de Vidros e Faróis
✓ Carro Reserva por 7 dias
✓ Danos a Terceiros até R$ 30.000

━━━━━━━━━━━━━━━━━━
📦 *OPÇÃO 2: SELECT ONE APLICATIVO*
💵 *R$ 166,00/mês*

✅ *O que está incluso:*
✓ Proteção contra Roubo e Furto (100% FIPE)
✓ Assistência 24h com Guincho (300km)
✓ Chaveiro e Socorro Elétrico
✓ Rastreamento em tempo real via App
✓ Danos a Terceiros até R$ 15.000

━━━━━━━━━━━━━━━━━━

📝 *Taxa de Adesão:* R$ 150,00
⏰ Cotação válida por 7 dias

🔗 *Acesse sua cotação completa:*
https://pratic-connect-21.lovable.app/cotacao/abc123

Qual opção te interessou mais? Estou à disposição para tirar qualquer dúvida! 😊
```

## Benefícios

1. **Consolidação completa** - Todos os planos selecionados aparecem na mensagem
2. **Benefícios detalhados** - Lista completa de coberturas de cada plano
3. **Personalização via IA** - Texto mais humanizado e atrativo
4. **Fallback robusto** - Se a IA falhar, usa mensagem padrão estruturada
5. **Link da cotação** - Cliente pode ver detalhes completos online
6. **Feedback visual** - Usuário sabe quando a mensagem está sendo gerada

## Considerações Técnicas

- **Rate limiting**: A Edge Function usará o modelo `google/gemini-3-flash-preview` (rápido e econômico)
- **Timeout**: Definir timeout de 10s para a IA, com fallback automático
- **Cache**: Considerar cache local de mensagens geradas para cotações repetidas
- **Tamanho**: Mensagens de WhatsApp têm limite de ~65.000 caracteres - não será problema

