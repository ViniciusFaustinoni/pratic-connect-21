## Contexto

O modal "Relatar Erro" (`src/components/suporte/RelatarErroModal.tsx`) já tem `accept="image/*,application/pdf"` no input, mas há uma validação que **obriga** pelo menos 1 anexo a ser imagem:

```ts
if (!hasImage) return toast.error('Pelo menos 1 anexo precisa ser uma imagem (print)');
```

Isso impede que o usuário envie um relato anexando apenas PDF. O bucket de storage `relatos-erros` não tem restrição de MIME, então o problema é só no front.

## Mudanças

**Arquivo:** `src/components/suporte/RelatarErroModal.tsx`

1. Remover a obrigação de imagem:
   - Apagar a checagem `if (!hasImage) ...` no `submit`
   - Remover o `disabled={... || !hasImage}` do botão Enviar
   - Remover o aviso "É obrigatório anexar pelo menos 1 print (imagem)..."

2. Manter a regra de pelo menos 1 anexo (qualquer tipo aceito: imagem ou PDF).

3. Atualizar o label para refletir o novo comportamento:
   - De: `Prints do erro *`
   - Para: `Anexos do erro (prints ou PDF) *`

4. Atualizar o texto do dropzone:
   - De: `Clique para anexar (até 10 arquivos, 10MB cada)`
   - Manter, já é genérico — apenas conferir que continua claro.

5. Ajustar a copy do bloco "Boas práticas" mantendo a recomendação de print, mas deixando claro que PDF também é aceito quando útil (ex.: relatório, documento gerado pelo sistema).

## Resultado

Usuário poderá enviar um relato de erro anexando somente PDF(s), somente imagem(ns) ou uma mistura — desde que tenha pelo menos 1 anexo.
