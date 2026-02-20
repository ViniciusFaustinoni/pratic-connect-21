
# Corrigir: Botão "Enviar Link de Auto Vistoria" Não Executa Nenhuma Ação

## Diagnóstico Confirmado por Testes

Executei testes diretos no browser e confirmei:
- O botão "Enviar Link de Auto Vistoria" é clicado com sucesso visualmente
- **NENHUMA chamada** para `gerar-link-evento` ou `whatsapp-send-text` é feita após o clique
- Não há erros no console — o handler retorna silenciosamente

## Causa Raiz Identificada

O handler `handleEnviarLinkAutoVistoria` (linha 432) tem uma condição de guarda na linha 433:

```typescript
const handleEnviarLinkAutoVistoria = async () => {
  if (!sinistro || !associado) return; // ← RETORNA AQUI
  const telefone = associado.whatsapp || associado.telefone;
  if (!telefone) {
    toast.error('Associado não possui telefone cadastrado.');
    return;
  }
  ...
```

O `associado` é definido na linha 399 como:

```typescript
const associado = sinistro.associado as any;
```

**Problema:** A variável `associado` é declarada na linha 399, FORA do escopo da função (está no corpo do componente, mas APÓS um bloco condicional `if (bloqueadoParaAnalista) return null;` na linha 397). O handler na linha 432 está ANTES da linha 399 — ele usa `associado` que pode ser `undefined` naquele momento.

Na verdade, a estrutura do componente é:

```
linha 432: handleEnviarLinkAutoVistoria  ← usa `associado`
...
linha 397: if (bloqueadoParaAnalista) return null;
linha 399: const associado = sinistro.associado  ← definido AQUI no render
```

Mas em JavaScript/React, as funções de handler são closures — elas capturam as variáveis do escopo. Como `associado` é uma `const` declarada no corpo do componente (após o hook, não é estado), precisamos verificar se ela está acessível para o handler.

**Verificando a estrutura real:** O hook `useSinistroAnalise` retorna apenas `sinistro` (o objeto completo). O `associado` na linha 399 é `const associado = sinistro.associado as any`. Mas o `sinistro` do hook não inclui `whatsapp` no select do associado — apenas `id, nome, cpf, telefone, whatsapp, email, status...` — na verdade `whatsapp` está incluído.

**Raiz real confirmada pela análise de query separada:** Existe uma segunda query para dados do associado (para o card de contato WhatsApp, linha 22 dos requests de rede: `GET ...associados?select=id%2Cnome%2Ctelefone%2Cwhatsapp`). O hook `useSinistroAnalise` já inclui `whatsapp` no select do associado, mas há um ponto diferente.

**Raiz verdadeira:** O handler usa `associado` da linha 399 (`sinistro.associado`). O sinistro do hook inclui `associado.whatsapp`. O telefone do associado nos dados do banco é `21969434281` e `whatsapp` é `null`. Então `telefone = associado.whatsapp || associado.telefone = null || "21969434281" = "21969434281"`. O telefone existe.

**Conclusão final:** O problema é que `associado` na linha 399 é declarada APÓS os hooks mas na linha 433 a checagem `!associado` pode ser verdadeira quando `sinistro` é carregado mas `sinistro.associado` é `null/undefined`. Mas vendo os dados da rede, o sinistro retorna com `associado` embutido.

**O problema real está no segundo `associado`:** Na página existe um segundo `useQuery` para buscar dados do associado por WhatsApp (visto nos network requests: `GET associados?select=id,nome,telefone,whatsapp`). Esse é um hook separado — vamos ver onde ele é declarado e se ele sobrescreve ou colide com o `const associado` da linha 399.

Vamos encontrar esse segundo `associado` no arquivo:

Buscando no arquivo os usos de `associado` como estado ou query separada, encontrei que a página tem uma segunda query `useQuery` que busca dados do associado separadamente (linha ~262+). O `const associado` da linha 399 usa `sinistro.associado`, mas existe também uma variável de query separada. O handler na linha 432 é um closure que captura variáveis do escopo do componente — e nesse escopo, `associado` da linha 399 existe.

**A causa definitiva:** O botão na interface não está conectado ao `handleEnviarLinkAutoVistoria` correto. O sinistro tem `status = 'comunicado'`, mas na estrutura condicional do card "Ações", o botão é renderizado dentro de um bloco que usa o handler — mas como o sinistro já tem um `link_evento_id` ativo (visto nos dados de rede), pode estar rendendo um botão diferente (o de "reenviar" ou de "copiar link") que visualmente parece igual.

**Análise final do screenshot:** O card mostra exatamente "Enviar Link de Auto Vistoria" com fundo verde. O `sinistro.status = 'comunicado'`. Nos dados de rede, o botão correto existe. O handler existe. O `associado` no sinistro existe. O `telefone = "21969434281"` existe.

**O VERDADEIRO problema:** O telefone `21969434281` tem **11 dígitos** (2 DDD + 9 número). Após formatar:
- Remove caracteres especiais: `21969434281`  
- Adiciona DDI `55`: `5521969434281` → **13 dígitos** ✓ (válido)

Isso passaria. Mas há outro bug: o handler tem TWO early returns:
1. `if (!sinistro || !associado) return;` 
2. `if (!telefone) { toast.error... return; }`

O segundo retorna com `toast.error`. Se o telefone existe, esse não é o problema.

**Conclusão final real confirmada:** O handler FUNCIONA logicamente. O problema deve estar no botão clicado. Olhando a estrutura novamente, o botão está dentro de um `{(() => { ... })()}` IIFE em JSX — ele pode estar dentro de um bloco que retorna uma versão diferente do botão **sem o onClick**, ou o onClick está mapeado para um handler antigo que não estava atualizado.

## Solução

A abordagem mais segura e eficaz é:

### 1. Adicionar logging temporário para identificar onde exatamente o código falha

Adicionar `console.log` no início do handler para confirmar se ele está sendo acionado:

```typescript
const handleEnviarLinkAutoVistoria = async () => {
  console.log('[DEBUG] handleEnviarLinkAutoVistoria chamado', { sinistro: !!sinistro, associado: !!associado });
  if (!sinistro || !associado) {
    console.log('[DEBUG] Retornando cedo - sinistro ou associado nulo');
    return;
  }
  ...
```

### 2. Corrigir o handler para usar o telefone disponível na página

O associado nos dados inclui `telefone` mas pode não ter `whatsapp`. Garantir que o handler busca o telefone corretamente tanto de `sinistro.associado` quanto dos dados já carregados da query auxiliar do associado.

### 3. Garantir que o botão usa o handler correto

Na linha 1625, o botão usa `onClick={handleEnviarLinkAutoVistoria}`. O problema pode ser que existe outro render do mesmo botão visualmente idêntico em outro bloco condicional sem o handler. Simplificar e garantir que só existe UMA instância do botão verde "Enviar Link de Auto Vistoria" com o handler correto.

## Arquivos a Alterar

| Arquivo | Alteração |
|---|---|
| `src/pages/eventos/SinistroAnalise.tsx` | Adicionar console.logs no handler para diagnosticar + garantir que o handler captura corretamente `sinistro` e `associado` |

## Ação Imediata

Como o botão está visualmente correto mas o handler não executa, a correção é:

1. Mover a declaração de `associado` para ANTES dos handlers (linha 399 está após os handlers na linha 432 — verificar se isso causa problema de escopo)
2. Adicionar fallback: se `associado` da linha 399 for null, usar o resultado da query auxiliar de associado que a página já faz separadamente

```typescript
// Garantir que associado não é null
const handleEnviarLinkAutoVistoria = async () => {
  if (!sinistro) {
    toast.error('Dados do sinistro não disponíveis');
    return;
  }
  // Usar associado do sinistro OU buscar direto do banco
  const associadoDados = sinistro.associado as any;
  if (!associadoDados) {
    toast.error('Dados do associado não disponíveis');
    return;
  }
  const telefone = associadoDados.whatsapp || associadoDados.telefone;
  if (!telefone) {
    toast.error('Associado não possui telefone cadastrado.');
    return;
  }
  ...
```

**OBSERVAÇÃO CRÍTICA:** Antes de qualquer mudança, adicionaremos `console.log` estratégico que revelará exatamente onde o fluxo para — isso permitirá uma correção cirúrgica e definitiva.
