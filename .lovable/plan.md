
## Plano: Reformular fluxo do Agente Consultor IA para leads

### Problemas identificados
1. **Valores incorretos**: A IA mostra valores na conversa (ex: "R$ 45,00/mês") mas esses valores são os calculados internamente — devem ser mostrados apenas via link da cotação
2. **Pede telefone**: A IA pede telefone do lead, mas já tem essa info (está conversando com ele pelo WhatsApp)
3. **Não pede email**: Para enviar o link da cotação, deveria pedir o email
4. **Não pede data de vencimento**: A cotação exige `dia_vencimento` — a IA deve oferecer as opções disponíveis
5. **Valor adicional fixo**: Deve sempre usar R$ 5,50 como `valor_adicional`
6. **Adesão e instalação**: Adesão sempre isenta (R$ 0,00) e instalação à escolha do lead
7. **Após envio do link**: A IA deve esperar 10s, enviar resumo da cotação, e ficar disponível para dúvidas

### Arquivo alterado
**`supabase/functions/agente-consultor-ia/index.ts`**

### Mudanças detalhadas

#### 1. System prompt do lead (linhas 360-444)
Reescrever o fluxo de cotação no prompt:

```
## FLUXO DE COTAÇÃO (OBRIGATÓRIO)
1. Cumprimente e pergunte a PLACA do veículo
2. Use consultar_placa para obter dados automaticamente
3. Confirme os dados do veículo com o cliente
4. Pergunte: "O veículo é usado para aplicativo (Uber, 99, etc.)?"
5. Pergunte a REGIÃO (estado/cidade)
6. Use calcular_cotacao (internamente — NÃO mostre valores ao cliente)
7. Pergunte a melhor DATA DE VENCIMENTO oferecendo as opções disponíveis via ferramenta
8. Pergunte o EMAIL do cliente (para receber a cotação)
9. Registre a cotação e envie o link

## REGRAS ABSOLUTAS SOBRE PREÇOS
- NUNCA informe valores de planos na conversa
- NUNCA liste planos com preços — os detalhes estarão no link
- Diga apenas: "Encontrei X opções de plano para o seu veículo! Vou preparar sua cotação personalizada."

## SOBRE O TELEFONE
- Você JÁ TEM o telefone do cliente (é o número pelo qual está conversando)
- NUNCA peça o telefone — use o número da conversa automaticamente

## SOBRE ADESÃO E INSTALAÇÃO
- A adesão é sempre ISENTA (R$ 0,00)
- A instalação do rastreador fica à escolha do cliente (rota ou base)
- Pergunte: "Para a instalação do rastreador, prefere que vá até você (rota) ou prefere ir até uma de nossas bases?"

## APÓS ENVIO DO LINK
- Após enviar o link, aguarde e envie um resumo: veículo, região, quantidade de planos disponíveis
- Finalize com: "Estou à disposição para qualquer dúvida! 😊"
```

#### 2. Tool `calcular_cotacao` — adicionar parâmetro `dia_vencimento` (linha 465-480)
Novo campo no tool definition:
```typescript
dia_vencimento: { type: "number", description: "Dia do mês para vencimento das mensalidades" }
```

#### 3. Nova tool `obter_opcoes_vencimento`
Retorna as duas opções de vencimento disponíveis baseado no dia atual (usando mesma lógica de `calcularOpcoesVencimento`):
```typescript
{
  name: "obter_opcoes_vencimento",
  description: "Retorna as opções de dia de vencimento disponíveis para o cliente escolher",
  parameters: { type: "object", properties: {}, required: [] }
}
```

#### 4. Tool `registrar_cotacao` — reformular (linhas 483-516)
- Remover `telefone_cliente` dos required (usar `telLimpo` direto)
- Adicionar `email_cliente`, `dia_vencimento`, `tipo_instalacao`
- Valor adicional fixo de R$ 5,50
- Adesão sempre R$ 0,00
- Salvar `dia_vencimento` e `tipo_instalacao` na `cotacoes_publicas`

#### 5. Função `executarRegistroCotacao` (linhas 1142-1226)
- Usar `telLimpo` como telefone (não pedir ao lead)
- Salvar `email_solicitante`, `dia_vencimento`, `tipo_instalacao`
- Valor adicional fixo = 5.50
- Valor adesão = 0
- Após registrar, aguardar 10 segundos e enviar mensagem de resumo

#### 6. Função `executarCalculoCotacao` (linhas 956-1137)
- Aplicar `valor_adicional = 5.50` sobre cada plano
- Não retornar `mensagem_formatada` com valores (os valores vão apenas no link)
- Retornar apenas contagem de planos e IDs para uso interno

#### 7. Handler `obter_opcoes_vencimento`
Nova função simples:
```typescript
async function executarObterOpcoesVencimento() {
  const diaHoje = new Date().getDate();
  // Mesma lógica de calcularOpcoesVencimento
  let opcoes: [number, number];
  if (diaHoje >= 30 || diaHoje <= 4) opcoes = [5, 10];
  else if (diaHoje <= 9) opcoes = [10, 15];
  else if (diaHoje <= 14) opcoes = [15, 20];
  else if (diaHoje <= 19) opcoes = [20, 25];
  else if (diaHoje <= 24) opcoes = [25, 30];
  else opcoes = [30, 5];
  return { opcoes, mensagem: `Dia ${opcoes[0]} ou dia ${opcoes[1]}` };
}
```

### Resumo do novo fluxo
```text
Lead: "Oi, quero cotação"
IA: Cumprimento + pede placa
Lead: "ABC1D23"
IA: [consultar_placa] → "Encontrei: Toyota Corolla 2014 Flex. Confere?"
Lead: "Sim"
IA: "É usado pra app?" → "Qual região?"
Lead: respostas
IA: [calcular_cotacao] internamente → [obter_opcoes_vencimento]
IA: "Encontrei 4 opções! Qual a melhor data de vencimento: dia 10 ou dia 15?"
Lead: "10"
IA: "Para a instalação do rastreador, prefere rota ou base?"
Lead: "Rota"
IA: "Me informe seu email para enviar a cotação"
Lead: "email@test.com"
IA: [registrar_cotacao] → envia link
IA: "Pronto! Sua cotação está no link: ..."
[10s delay]
IA: "Resumo: Toyota Corolla 2014 Flex, RJ, 4 planos. Adesão isenta! Estou à disposição!"
```
