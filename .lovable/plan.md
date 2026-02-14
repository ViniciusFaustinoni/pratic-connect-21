

# Alinhamento da Tabela Comparativa — Correções Pendentes

## Auditoria do Estado Atual

Comparando a tabela de especificação com o código atual, a maioria dos fluxos já está implementada corretamente. Abaixo, o resultado da auditoria e as correções necessárias.

### Já correto:
- Colisão: fluxo completo com 13 passos, B.O., vistoria presencial, oficina, pode ser PT
- Roubo/Furto: acionamento automático do rastreador, sem vistoria, sem oficina (exceto recuperado)
- Vidros: carência 120 dias, limite 12 meses por peça, B.O. opcional, sem vistoria presencial
- Incêndio: laudo bombeiros dinâmico, análise interna GNV/sobrecarga, diverge PT/parcial
- Alagamento: comprovante evento, fotos in loco, tipo de água, análise jurídica, diverge PT/parcial
- Perda total universal: qualquer tipo com PT aprovada vai para indenização integral
- Bloqueio de OS para perda total
- Depreciação aplica apenas a maior

### Gaps encontrados (3 correções):

---

## Correção 1 — Roubo NÃO exige chaves (apenas Furto)

A tabela diz claramente:
- **Roubo**: "Não exige chaves. Aciona rastreador."
- **Furto**: "Exige chaves. Aciona rastreador."

O código atual em `DOCUMENTOS_OBRIGATORIOS` tem `chaves` como obrigatório para **ambos** roubo e furto:

```
roubo: [
  ...
  { tipo: 'chaves', nome: 'Declaração das Chaves', obrigatorio: true },  // ← ERRADO
],
furto: [
  ...
  { tipo: 'chaves', nome: 'Declaração das Chaves', obrigatorio: true },  // ← CORRETO
],
```

**Ação**: Remover o documento `chaves` da lista de documentos obrigatórios do tipo `roubo`.

## Correção 2 — Fenômeno Natural: comprovante do evento deve ser obrigatório

A tabela diz: "Comprovante evento obrigatório antes de avançar"

O código atual tem `comprovante_evento` com `obrigatorio: false`:

```
fenomeno_natural: [
  ...
  { tipo: 'comprovante_evento', nome: '...', obrigatorio: false },  // ← ERRADO
],
```

**Ação**: Alterar para `obrigatorio: true`.

## Correção 3 — Vidros: B.O. condicional (tentativa de furto)

A tabela diz: "B.O. exigido apenas se vidro quebrou por tentativa de furto"

O código atual tem B.O. como opcional (`obrigatorio: false`), o que está parcialmente correto, mas o sistema não tem um campo para indicar se foi tentativa de furto, nem torna o B.O. obrigatório nesse caso.

**Ação**: Adicionar um toggle "O dano foi causado por tentativa de furto?" no formulário de vidros. Se "Sim", tornar B.O. obrigatório dinamicamente nos documentos criados.

---

## Alterações em Código

### Arquivo: `src/components/eventos/NovoSinistroModal.tsx`

**1. Remover chaves de roubo (linha ~92-96)**:
```typescript
roubo: [
  { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
  { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
  { tipo: 'bo', nome: 'Boletim de Ocorrência', obrigatorio: true },
  // chaves REMOVIDO — roubo não exige chaves
],
```

**2. Comprovante fenômeno natural obrigatório (linha ~113)**:
```typescript
fenomeno_natural: [
  ...
  { tipo: 'comprovante_evento', nome: 'Comprovante do Evento (notícia/defesa civil)', obrigatorio: true },
],
```

**3. Toggle tentativa de furto para vidros**:
- Novo state: `tentativaFurto` (boolean)
- Quando tipo = vidros, exibir toggle "O dano foi causado por tentativa de furto/roubo?"
- Se sim, ao criar documentos pendentes, marcar o B.O. como obrigatório

---

## Resumo dos Arquivos

| Ação | Arquivo |
|---|---|
| Modificar | `src/components/eventos/NovoSinistroModal.tsx` (3 correções: chaves roubo, comprovante obrigatório, toggle tentativa furto) |

## Ordem de Implementação

1. Remover `chaves` dos documentos de roubo
2. Alterar `comprovante_evento` para obrigatório em fenômeno natural
3. Adicionar toggle "tentativa de furto" para vidros com B.O. condicional

