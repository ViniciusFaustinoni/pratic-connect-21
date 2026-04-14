

## Plano: Corrigir fluxo de cotação do Agente Consultor IA — datas e perda de contexto

### Diagnóstico raiz

O histórico de conversa é carregado da tabela `whatsapp_mensagens` (linhas 237-243), que contém apenas texto das mensagens. **As tool calls (consultar_placa, calcular_cotacao, obter_opcoes_vencimento) e seus resultados NÃO são persistidos.** Quando o lead envia a próxima mensagem (ex: "15" para vencimento), a IA vê o texto da conversa mas não sabe que já calculou a cotação, quais planos foram encontrados, nem em qual passo do fluxo está. Resultado: a IA reinicia a conversa.

Para as datas: a ferramenta `obter_opcoes_vencimento` retorna corretamente 2 opções, mas a IA pode ignorá-la e oferecer todas as datas por conta própria, pois não há reforço suficiente no prompt.

Além disso, a `instrucao` retornada por `calcular_cotacao` (linha 1186) ainda menciona "tipo de instalação".

### Solução: Persistir estado do fluxo no contato

**Arquivo: `supabase/functions/agente-consultor-ia/index.ts`**

#### 1. Migração: adicionar campo `dados_cotacao` na tabela `agente_ia_contatos`

```sql
ALTER TABLE agente_ia_contatos 
ADD COLUMN IF NOT EXISTS dados_cotacao JSONB DEFAULT NULL;
```

Esse campo armazenará o estado acumulado do fluxo:
```json
{
  "etapa": "aguardando_vencimento",
  "placa": "ABC1D23",
  "marca": "Toyota",
  "modelo": "Corolla",
  "ano": 2014,
  "combustivel": "flex",
  "valor_fipe": 65000,
  "regiao": "rj",
  "uso_app": false,
  "planos_calculados": [...],
  "dia_vencimento": null,
  "email": null,
  "nome": null
}
```

#### 2. Persistir estado após cada tool call

Cada ferramenta salva os dados coletados no campo `dados_cotacao`:

- **consultar_placa** → salva placa, marca, modelo, ano, combustível, valor_fipe + etapa `"aguardando_confirmacao"`
- **calcular_cotacao** → salva região, uso_app, planos_calculados + etapa `"aguardando_vencimento"`
- **obter_opcoes_vencimento** → salva opcoes + etapa `"aguardando_vencimento_resposta"`
- **registrar_cotacao** → salva tudo + etapa `"cotacao_enviada"`

#### 3. Injetar estado no system prompt

Após carregar o contato e antes de montar o prompt, ler `contato.dados_cotacao` e adicionar uma seção ao system prompt:

```
## ESTADO ATUAL DO FLUXO
Você JÁ está no meio de uma cotação. Dados coletados até agora:
- Placa: ABC1D23
- Veículo: Toyota Corolla 2014 Flex
- Valor FIPE: R$ 65.000
- Região: RJ
- Planos calculados: 4 opções
- ETAPA ATUAL: aguardando_vencimento
- PRÓXIMO PASSO: Pergunte a data de vencimento (opções: dia 20 ou dia 25)
NÃO reinicie a conversa. Continue de onde parou.
```

#### 4. Reforçar uso da ferramenta de vencimento

No prompt (linha 431), adicionar:
```
8. Use a ferramenta obter_opcoes_vencimento e ofereça APENAS as duas datas retornadas pela ferramenta. 
   NÃO invente datas. NÃO ofereça outras opções além das retornadas.
```

Na resposta da tool `obter_opcoes_vencimento`, reforçar:
```
"instrucao": "Ofereça APENAS estas duas opções ao cliente: dia X ou dia Y. NÃO ofereça nenhuma outra data."
```

#### 5. Corrigir instrução residual em `calcular_cotacao`

Linha 1186 — remover menção a "tipo de instalação":
```typescript
instrucao: "IMPORTANTE: NÃO mostre valores ao cliente. Prossiga pedindo dia de vencimento, email e nome."
```

#### 6. Corrigir mensagem de resumo em `registrar_cotacao`

Linhas 1293-1300 — remover a linha de "Instalação" do resumo, já que não é mais perguntado na conversa.

### Resumo das alterações

1. **Migração SQL**: Adicionar coluna `dados_cotacao JSONB` em `agente_ia_contatos`
2. **Edge Function** (`agente-consultor-ia/index.ts`):
   - Persistir estado do fluxo após cada tool call
   - Injetar estado no system prompt para manter contexto
   - Reforçar uso exclusivo das 2 datas da ferramenta
   - Remover menções residuais a "tipo de instalação"
   - Remover linha de instalação do resumo

