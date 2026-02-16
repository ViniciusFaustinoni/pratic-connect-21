

# IA WhatsApp: Perguntar Reboque + Confirmar Endereco do Associado

## Problema Atual

O prompt da IA (system prompt no `whatsapp-webhook`) ja instrui a IA a perguntar sobre assistencia apos sinistro (linhas 306-314), mas:

1. A instrucao e generica ("Voce precisa de alguma assistencia?") -- nao enfatiza **reboque** como prioridade em colisao
2. O contexto da IA **nao inclui o endereco do associado**, entao ela nao pode sugerir "Quer guincho para [seu endereco]?"
3. Nao ha instrucao para confirmar o endereco cadastrado como destino do guincho

## Solucao

### 1. Incluir endereco do associado no contexto da IA

**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts`

Na query principal que busca dados do associado (linha ~1652), adicionar os campos de endereco:

```typescript
// De:
.select("nome, email, telefone, whatsapp, cpf, status, plano:planos(nome)")

// Para:
.select("nome, email, telefone, whatsapp, cpf, status, logradouro, numero, bairro, cidade, uf, cep, plano:planos(nome)")
```

Na funcao que monta o contexto (linha ~1758), adicionar secao de endereco:

```typescript
## DADOS DO ASSOCIADO
- **Nome Completo**: ${associado?.nome || 'N/A'}
- **Primeiro Nome**: ${primeiroNome}
- **CPF**: ${associado?.cpf || 'N/I'}
- **Status**: ${associado?.status || 'N/A'}
- **Plano**: ${associado?.plano?.nome || 'Nao definido'}
- **Endereco Cadastrado**: ${[associado?.logradouro, associado?.numero, associado?.bairro, associado?.cidade, associado?.uf].filter(Boolean).join(', ') || 'Nao informado'}
```

### 2. Atualizar instrucoes do prompt para colisao + reboque

**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts`

Substituir a secao "POS-SINISTRO" (linhas 306-314) por instrucoes mais especificas:

```text
## POS-SINISTRO: OFERECER ASSISTENCIA 24H (OBRIGATORIO!)
Apos registrar um sinistro com sucesso (tool criar_solicitacao_sinistro retornou sucesso):
1. Confirme o registro do sinistro ao associado
2. Se o veiculo tiver cobertura_total = true:
   a. Para sinistros de COLISAO: SEMPRE pergunte especificamente sobre REBOQUE/GUINCHO:
      "Voce precisa de um guincho? Podemos enviar para o seu endereco: [ENDERECO CADASTRADO DO ASSOCIADO]. Ou prefere enviar para outro local?"
   b. Para outros tipos: pergunte genericamente sobre assistencia (guincho, chaveiro, troca de pneu)
3. Se o associado confirmar que precisa de guincho:
   - Use o local do sinistro como endereco de RETIRADA (origem)
   - Se confirmar o endereco cadastrado, use-o como DESTINO
   - Se informar outro endereco, use o endereco informado como DESTINO
   - Colete a descricao e crie o chamado com criar_solicitacao_assistencia
4. Se responder NAO, encerre normalmente com mensagem de acolhimento
IMPORTANTE: So ofereca assistencia 24h se o veiculo tiver cobertura_total = true.
```

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/whatsapp-webhook/index.ts` | 1. Adicionar campos de endereco no SELECT do associado (linha ~1654) |
| | 2. Adicionar endereco cadastrado no contexto da IA (linha ~1764) |
| | 3. Atualizar instrucoes pos-sinistro para priorizar reboque em colisao e confirmar endereco (linhas 306-314) |

Nenhuma migration necessaria.
