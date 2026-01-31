

# Melhoria: Compartilhamento de Planos via WhatsApp com Benefícios Estruturados

## Resumo do Problema

Atualmente, ao clicar em **"Copiar para WhatsApp"**, a mensagem gerada não apresenta os benefícios de forma organizada por categoria. O sistema envia uma lista simples de coberturas para a IA gerar a mensagem, mas não há estruturação por tipo (Coberturas, Assistência 24h, Extras).

## Análise Técnica

### Fluxo Atual
```text
CotacaoCard → copiarParaWhatsApp() → Edge Function gerar-mensagem-whatsapp → IA Gemini → Mensagem
```

### Dados Atuais Enviados à Edge Function
```javascript
planos: [{
  nome: "SELECT PREMIUM",
  valorMensal: 166.00,
  coberturas: ["Roubo e Furto", "Colisão", ...], // Lista simples
  naoInclui: []
}]
```

### Estrutura do Banco de Dados
O banco já possui categorização de benefícios:
- `benefits.category = 'cobertura'` → Coberturas Principais
- `benefits.category = 'assistencia'` → Assistência 24h
- `benefits.category = 'extra'` → Benefícios Exclusivos

### Problema Identificado
A tabela `planos` armazena coberturas como um array simples de strings, sem categoria. O sistema usa essa tabela para cotações, perdendo a informação de categorização disponível na tabela `benefits`.

## Solução Proposta

### Parte 1: Enriquecer Dados Antes de Enviar ao WhatsApp

Modificar a função `copiarParaWhatsApp` em `Cotacoes.tsx` para:
1. Categorizar as coberturas automaticamente usando um mapeamento
2. Enviar os benefícios organizados por categoria para a Edge Function

### Parte 2: Atualizar Edge Function para Benefícios Categorizados

Modificar `gerar-mensagem-whatsapp` para:
1. Aceitar benefícios estruturados por categoria
2. Instruir a IA a apresentar cada categoria separadamente na mensagem

### Parte 3: Atualizar Fallback Local

Garantir que a função `gerarMensagemFallback` também apresente benefícios por categoria.

## Detalhamento Técnico

### Arquivo: `src/pages/vendas/Cotacoes.tsx`

Adicionar mapeamento de categorias e reestruturar dados:

```typescript
// Mapeamento de coberturas para categorias
const CATEGORIAS_BENEFICIOS: Record<string, string> = {
  'Roubo e Furto': 'cobertura',
  'Colisão': 'cobertura',
  'Perda Total': 'cobertura',
  'Incêndio': 'cobertura',
  'Alagamento': 'cobertura',
  'Chuva de Granizo': 'cobertura',
  'Danos a Terceiros': 'cobertura',
  'Danos Terceiros': 'cobertura',
  'Vidros e Faróis': 'cobertura',
  'Assistência 24h': 'assistencia',
  'Rastreador/Monitoramento': 'assistencia',
  'Reboque': 'assistencia',
  'Reboque Excedente': 'assistencia',
  'Kit Gás': 'extra',
  'Carro Reserva': 'extra',
  'Clube Gás': 'extra',
  '100% FIPE APP': 'extra',
};

// Função para categorizar coberturas
const categorizarBeneficios = (coberturas: string[]) => {
  const resultado = {
    coberturas: [] as string[],
    assistencia: [] as string[],
    extras: [] as string[],
  };
  
  coberturas.forEach(cob => {
    // Buscar categoria pelo mapeamento ou por palavras-chave
    let categoria = 'coberturas'; // default
    
    for (const [nome, cat] of Object.entries(CATEGORIAS_BENEFICIOS)) {
      if (cob.toLowerCase().includes(nome.toLowerCase())) {
        categoria = cat === 'cobertura' ? 'coberturas' : 
                   cat === 'assistencia' ? 'assistencia' : 'extras';
        break;
      }
    }
    
    resultado[categoria].push(cob);
  });
  
  return resultado;
};
```

### Arquivo: `supabase/functions/gerar-mensagem-whatsapp/index.ts`

Atualizar interface e prompts:

```typescript
interface Plano {
  nome: string;
  valorMensal: number;
  coberturas: string[];
  beneficiosPorCategoria?: {
    coberturas: string[];
    assistencia: string[];
    extras: string[];
  };
  naoInclui?: string[];
}

// Novo prompt do sistema com instrução de categorização
const systemPrompt = `...
ESTRUTURA DE BENEFÍCIOS POR CATEGORIA:
Para cada plano, organize os benefícios assim:
🛡️ *Coberturas:* Roubo e Furto, Colisão, Perda Total...
🚗 *Assistência 24h:* Reboque, Rastreamento...
✨ *Benefícios Extras:* Carro Reserva, Kit Gás...
...`;
```

### Arquivo: `src/pages/vendas/Cotacoes.tsx` - Função Fallback

Atualizar `gerarMensagemFallback` para usar categorias:

```typescript
const gerarMensagemFallback = (...) => {
  // ... código existente ...
  
  planos.forEach((plano) => {
    const beneficios = categorizarBeneficios(plano.coberturas);
    
    if (beneficios.coberturas.length > 0) {
      mensagem += `🛡️ *Coberturas:*\n`;
      beneficios.coberturas.forEach(c => mensagem += `✓ ${c}\n`);
    }
    
    if (beneficios.assistencia.length > 0) {
      mensagem += `\n🚗 *Assistência 24h:*\n`;
      beneficios.assistencia.forEach(c => mensagem += `✓ ${c}\n`);
    }
    
    if (beneficios.extras.length > 0) {
      mensagem += `\n✨ *Benefícios Extras:*\n`;
      beneficios.extras.forEach(c => mensagem += `✓ ${c}\n`);
    }
  });
};
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/vendas/Cotacoes.tsx` | Adicionar categorização de benefícios e atualizar `copiarParaWhatsApp` e `gerarMensagemFallback` |
| `supabase/functions/gerar-mensagem-whatsapp/index.ts` | Atualizar interface e prompts para benefícios categorizados |

## Exemplo de Mensagem Gerada

```text
Olá Marcos! 🚗

Preparamos uma cotação especial para seu *Volkswagen Voyage 2018*.

💰 *Valor FIPE:* R$ 48.336,00

━━━━━━━━━━━━━━━━━━
📦 *OPÇÃO 1: SELECT EXCLUSIVE APLICATIVO*
💵 *Mensalidade:* R$ 166,00/mês

🛡️ *Coberturas:*
✓ Roubo e Furto
✓ Colisão
✓ Perda Total
✓ Incêndio
✓ Alagamento
✓ Chuva de Granizo
✓ Danos a Terceiros R$ 40mil

🚗 *Assistência 24h:*
✓ Assistência 24h 400km
✓ Rastreador/Monitoramento
✓ 1000km Reboque

✨ *Benefícios Extras:*
✓ Kit Gás
✓ 100% FIPE APP
✓ Carro Reserva

━━━━━━━━━━━━━━━━━━
📦 *OPÇÃO 2: SELECT ONE APLICATIVO*
💵 *Mensalidade:* R$ 166,00/mês

🛡️ *Coberturas:*
✓ Roubo e Furto
...

━━━━━━━━━━━━━━━━━━

📝 *Taxa de Adesão:* R$ 199,90
⏰ Cotação válida por 7 dias.

🔗 Veja mais detalhes: https://...

Qual opção te interessou mais? 😊
```

## Resultado Esperado

1. Todos os planos selecionados aparecem na mensagem
2. Benefícios organizados por categoria (Coberturas, Assistência, Extras)
3. Formato visual limpo e fácil de comparar
4. Mensagem funciona tanto via IA quanto via fallback local

