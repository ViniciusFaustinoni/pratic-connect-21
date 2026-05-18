## Diagnóstico

O botão `Criar Solicitação` em `TrocaTitularidadeDialog.tsx` (linha 359) tem 3 gates:

```ts
disabled={criar.isPending || !veiculoId || sgaTransitorioVisivel}
```

Você confirmou: **veículos aparecem, você escolhe, o texto muda, mas o botão segue desabilitado, sem erro no console.**

Como `criar.isPending` só fica `true` durante o POST e o texto do `<select>` muda (logo o `onChange` está disparando), o gate culpado é o terceiro: **`sgaTransitorioVisivel`**.

### Como isso acontece mesmo "tendo veículos do SGA"

A query `useBoletosSgaPorAssociado` tem `staleTime: 30s` e refaz background fetch (foco da janela, retry interno). Quando o refetch retorna `erro_transitorio: true` (timeout/auth do Hinova), o payload é sobrescrito por um vazio com a flag transitória, e a UI cai no **fallback local** (`veiculosFallback` da nossa base, que é espelho do SGA — por isso "parece SGA"). O dropdown segue listando veículos, mas a flag `sgaTransitorioVisivel` permanece `true`, mantendo o botão bloqueado.

A correção anterior (`!usandoFallback`) cobre parcialmente, mas só funciona se a query tiver realmente caído pro fallback antes do clique. Em janelas de instabilidade rápida (SGA volta a responder antes do fallback materializar), a flag ainda trava.

### Por que esse gate nem deveria existir

O backend `criar-solicitacao-troca-titularidade` NÃO precisa do SGA online — ele recebe `veiculo_id` (UUID local) e cria a solicitação direto no nosso banco. O SGA é só auxílio visual para listar quais veículos do associado existem. Logo, basta ter um `veiculo_id` válido escolhido para submeter.

## Mudanças

### 1) `src/components/associados/TrocaTitularidadeDialog.tsx`

**Remover `sgaTransitorioVisivel` do disable do botão.** Mantém apenas:

```ts
disabled={criar.isPending || !veiculoId || !nome.trim()}
```

Justificativa: `veiculoId` só pode estar setado se algum dropdown renderizou opções válidas (SGA fresco OU fallback local). Em qualquer dos dois casos, a criação da solicitação é válida.

### 2) Feedback de motivo no botão desabilitado

Envolver o botão num `<Tooltip>` (`@/components/ui/tooltip`) que mostra a razão exata quando estiver disabled:
- `criar.isPending` → "Enviando…"
- `!veiculoId` → "Selecione o veículo a transferir"
- `!nome.trim()` → "Informe o nome do novo titular"

Isso evita futuras situações de "botão bloqueado sem motivo claro".

### 3) Salvaguarda no `handleSubmit`

O `handleSubmit` já valida `nome` e `veiculoId` (linha 219). Manter — funciona como segunda linha de defesa.

## Arquivos afetados

- `src/components/associados/TrocaTitularidadeDialog.tsx` (apenas o rodapé do dialog: ~15 linhas)

## Validação pós-implementação

1. Abrir o modal de Troca de Titularidade.
2. Esperar SGA carregar veículos.
3. Escolher um veículo + preencher nome.
4. Conferir que `Criar Solicitação` habilita imediatamente.
5. Hover no botão (quando faltar campo) mostra o motivo correto.

## Fora do escopo

- Não mexer no fluxo backend (`criar-solicitacao-troca-titularidade`).
- Não mexer nas queries SGA / fallback — comportamento de exibição continua igual.
- Não tocar nos demais gates do fluxo (assinatura termo, geração de link público, etc.).
