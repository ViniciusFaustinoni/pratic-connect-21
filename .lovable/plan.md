

## Plano: Corrigir loop de perguntas e garantir geração da cotação

### Problema
A IA entra em loop pedindo email, nome e vencimento repetidamente ao invés de chamar `registrar_cotacao`. Causas:
1. Quando o cliente fornece email/nome em texto, não há tool call, então o estado NÃO é atualizado — a IA "esquece" que já coletou
2. A ordem do fluxo no prompt (vencimento → email → nome) conflita com o que a IA faz naturalmente
3. Não há instrução forte para chamar `registrar_cotacao` quando todos os dados estão disponíveis

### Solução

**Arquivo: `supabase/functions/agente-consultor-ia/index.ts`**

#### 1. Adicionar tool `salvar_dados_cliente` para persistir email/nome

Nova ferramenta que a IA chama assim que o cliente informa email e nome:

```typescript
{
  name: "salvar_dados_cliente",
  description: "Salva o nome e email do cliente. CHAME IMEDIATAMENTE após o cliente informar email e nome.",
  parameters: {
    properties: {
      nome_cliente: { type: "string" },
      email_cliente: { type: "string" },
    },
    required: ["nome_cliente", "email_cliente"],
  },
}
```

Ao executar, atualiza `dados_cotacao` com email, nome e etapa `"aguardando_vencimento"`.

#### 2. Reordenar o fluxo no prompt (linhas 426-437)

Nova ordem alinhada com o que o usuário pediu:
```
7. Peça o EMAIL e o NOME COMPLETO do cliente
8. CHAME a ferramenta salvar_dados_cliente com os dados informados
9. Use obter_opcoes_vencimento e ofereça APENAS as duas datas retornadas
10. Após o cliente escolher, CHAME registrar_cotacao IMEDIATAMENTE e envie o link
```

#### 3. Reforçar chamada de `registrar_cotacao` no prompt

Adicionar regra explícita:
```
## REGRA CRÍTICA — GERAR COTAÇÃO
Quando você JÁ tem: placa, veículo, região, uso_app, email, nome e dia de vencimento, 
CHAME registrar_cotacao IMEDIATAMENTE. NÃO faça mais perguntas. NÃO repita dados já coletados.
```

#### 4. Atualizar instruções por etapa (linhas 501-508)

Ajustar para a nova ordem e adicionar a etapa `"aguardando_vencimento_resposta"`:
```typescript
"aguardando_vencimento": "Pergunte o vencimento. Ofereça APENAS as 2 datas das opcoes_vencimento.",
"aguardando_vencimento_resposta": "O cliente deve escolher uma data. Após escolher, CHAME registrar_cotacao IMEDIATAMENTE.",
"dados_cliente_coletados": "Pergunte a data de vencimento usando obter_opcoes_vencimento.",
"cotacao_enviada": "A cotação JÁ foi enviada. Esteja disponível para dúvidas.",
```

#### 5. Handler da nova tool `salvar_dados_cliente`

```typescript
} else if (fnName === "salvar_dados_cliente") {
  const novoEstado = {
    ...(dadosCotacao || {}),
    etapa: "dados_cliente_coletados",
    email: args.email_cliente,
    nome: args.nome_cliente,
  };
  await supabase.from("agente_ia_contatos").update({ dados_cotacao: novoEstado }).eq("id", contato.id);
  toolResult = { success: true, mensagem: "Dados salvos. Agora pergunte o dia de vencimento usando obter_opcoes_vencimento." };
}
```

### Resumo
1. Nova tool `salvar_dados_cliente` para persistir email/nome
2. Reordenar fluxo: email+nome → vencimento → registrar_cotacao
3. Regra explícita para chamar `registrar_cotacao` sem hesitar
4. Deploy da Edge Function

