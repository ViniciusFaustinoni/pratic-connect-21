## Objetivo
Permitir anexar imagem da área de transferência no modal de Relatar Erro (`src/components/suporte/RelatarErroModal.tsx`), via Ctrl+V e botão "Colar".

## Mudanças
Apenas em `src/components/suporte/RelatarErroModal.tsx`:

1. **Listener global de `paste` enquanto o modal estiver aberto**
   - `useEffect` adiciona `window.addEventListener('paste', onPaste)` quando `open === true`.
   - `onPaste` lê `e.clipboardData.items`, filtra `kind === 'file'` e `type.startsWith('image/')`, gera nome `colado-<timestamp>.png` e reaproveita `handleFiles()` (validação de tamanho/limite já existente).

2. **Botão "Colar da área de transferência"** ao lado do dropzone
   - Usa `navigator.clipboard.read()` para ler `ClipboardItem`s.
   - Para cada item com tipo `image/*`, converte em `File` e passa para `handleFiles()`.
   - Fallback: se a API não estiver disponível ou for negada, mostra `toast` orientando usar Ctrl+V.

3. **Microcopy**
   - Atualizar texto do dropzone para "Clique, arraste, **cole (Ctrl+V)** ou anexe imagens/PDF…".

## Fora de escopo
- Não mexer em hook `useErrorReports`, validações de backend, ou outros formulários.
- Não adicionar drag-and-drop (já existe via input file).
