## Objetivo

Tornar o anexo de print **obrigatório** no modal "Relatar Erro" (ao menos 1 imagem) para que o relato só possa ser enviado quando houver evidência visual.

## Mudanças

**Arquivo: `src/components/suporte/RelatarErroModal.tsx`**

1. **Label do campo**: trocar `"Prints do erro (opcional)"` por `"Prints do erro *"` (com asterisco vermelho destacando obrigatoriedade), igual aos outros campos obrigatórios.

2. **Texto do dropzone**: reforçar que é obrigatório anexar pelo menos 1 imagem do erro.

3. **Validação no `submit()`**: adicionar checagem antes do envio:
   - Se `files.length === 0` → `toast.error('Anexe pelo menos 1 print do erro')` e abortar.
   - Exigir que pelo menos 1 dos arquivos seja **imagem** (`type.startsWith('image/')`), já que "print" implica captura de tela. PDFs continuam aceitos como anexos extras, mas não substituem o print.

4. **Botão Enviar**: desabilitar quando `files.length === 0` (além do `isPending` atual), dando feedback visual imediato ao usuário antes mesmo de clicar.

5. **Mensagem auxiliar**: pequeno texto cinza abaixo do dropzone quando vazio: *"É obrigatório anexar pelo menos 1 print mostrando o erro."*

## Fora de escopo

- Não alterar o hook `useErrorReports` nem o schema do banco (a coluna de anexos já existe e aceita múltiplos arquivos).
- Não mexer no botão flutuante nem em outras telas.
