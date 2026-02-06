
## Plano: Correção da Exibição da Opção de Encaixe no Agendamento

### Problema Identificado

Na tela de agendamento, quando o usuário seleciona "Outra pessoa" para receber o técnico, a opção de **"Permitir encaixe de horário"** fica escondida até que os campos de nome e telefone do responsável sejam preenchidos.

**Linha problemática (546):**
```typescript
{endereco.logradouro && endereco.numero && (responsavel === 'eu' || (nomeResponsavel && telefoneResponsavel)) && (
```

Esta condição exige que, se "Outra pessoa" for selecionado, os campos nome e telefone estejam preenchidos para mostrar a opção de encaixe. Isso gera uma UX confusa porque o usuário não vê a opção de encaixe enquanto preenche os dados.

### Solução

Mostrar a opção de encaixe **sempre** após selecionar o responsável, independente do preenchimento dos campos. A validação de campos obrigatórios já é feita no `formularioValido()` antes de permitir confirmar.

---

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/cotacao-publica/AgendamentoVistoria.tsx` | Alterar condição de exibição da opção de encaixe |

---

### Alteração Detalhada

**Linha 546 - Alterar a condição:**

De:
```typescript
{endereco.logradouro && endereco.numero && (responsavel === 'eu' || (nomeResponsavel && telefoneResponsavel)) && (
```

Para:
```typescript
{endereco.logradouro && endereco.numero && (
```

Essa mudança faz a opção de encaixe aparecer assim que:
- O endereço (logradouro e número) estiver preenchido
- Independente da seleção de responsável (eu mesmo ou outra pessoa)

A validação completa do formulário (incluindo nome/telefone quando "outra pessoa") continua sendo feita pelo `formularioValido()` antes de mostrar o botão "Revisar agendamento".

---

### Fluxo Corrigido

```
ANTES (problemático):
┌─────────────────────────────────────────────────────────────────┐
│  1. Preenche endereço                                          │
│  2. Seleciona "Outra pessoa"                                   │
│  3. Campos nome/telefone aparecem                              │
│  4. Opção de encaixe ❌ ESCONDIDA                               │
│  5. Preenche nome e telefone                                   │
│  6. Opção de encaixe ✅ aparece                                │
└─────────────────────────────────────────────────────────────────┘

DEPOIS (corrigido):
┌─────────────────────────────────────────────────────────────────┐
│  1. Preenche endereço                                          │
│  2. Opção de encaixe ✅ já aparece                              │
│  3. Seleciona "Outra pessoa"                                   │
│  4. Campos nome/telefone aparecem                              │
│  5. Preenche nome e telefone                                   │
│  6. Botão "Revisar agendamento" aparece                        │
└─────────────────────────────────────────────────────────────────┘
```

---

### Resultado Esperado

1. A opção de encaixe ficará visível assim que o endereço for preenchido
2. O usuário pode ativar/desativar o encaixe enquanto preenche os dados do responsável
3. O botão de confirmar só aparece quando todos os campos obrigatórios estiverem preenchidos
4. Melhor experiência do usuário - todas as opções visíveis durante o preenchimento
