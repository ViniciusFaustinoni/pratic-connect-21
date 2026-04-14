

## Plano: Corrigir nome do agente e confiabilidade da consulta de placa

### Problemas identificados

**1. Nome "Pratic" em vez de "Vinicius"**
A tabela `agente_ia_config` tem `nome_agente = "Pratic"` e `apresentacao_inicial` diz "Sou a Pratic, consultora virtual". O codigo usa esses valores do banco como fonte primaria. Precisa atualizar os registros no banco.

**2. Veiculo errado (MARCOPOLO em vez de Toyota Corolla)**
O `plate-lookup` retornou dados corretos (Toyota Corolla XEi 2014, R$ 72.122), mas o modelo de IA ignorou o resultado da tool e alucinounos dados do veiculo. Causa provavel: o system prompt nao enfatiza suficientemente que o agente DEVE usar exclusivamente os dados retornados pela ferramenta, sem inventar.

### Solucao

**1. Atualizar `agente_ia_config` no banco (migration)**
```sql
UPDATE agente_ia_config SET valor = 'Vinicius' WHERE chave = 'nome_agente';
UPDATE agente_ia_config SET valor = 'Olá! Sou o Vinicius, consultor virtual da Praticcar Proteção Veicular. Estou aqui para te ajudar a encontrar a melhor proteção para o seu veículo. Posso começar fazendo uma cotação gratuita para você? Para isso, por favor, me informe a *placa* do seu veículo. 😊' WHERE chave = 'apresentacao_inicial';
```

**2. Reforcar no system prompt (leads) anti-alucinacao**
No prompt de vendas em `agente-consultor-ia/index.ts`, adicionar regra mais enfatica:

```
## REGRA CRITICA SOBRE DADOS DO VEICULO
- NUNCA invente ou adivinhe dados do veiculo (marca, modelo, ano, valor FIPE)
- SOMENTE use os dados retornados pela ferramenta consultar_placa
- Se a ferramenta retornar erro, peca os dados manualmente ao cliente
- NUNCA "chute" baseado na placa — SEMPRE aguarde o resultado da ferramenta
```

Tambem adicionar instrucao no tool result para reforcar: quando o tool result vier, incluir uma nota explicita tipo "DADOS OFICIAIS - USE APENAS ESTES DADOS".

### Arquivos alterados
- Migration SQL para `agente_ia_config`
- `supabase/functions/agente-consultor-ia/index.ts` — reforco anti-alucinacao no prompt e no retorno do tool

