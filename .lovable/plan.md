## Correção: erro "CPF extraído do documento é inválido" mesmo após correção manual

### Diagnóstico (cotação COT-20260427-162612349-929 — MOACIR JACINTO FERREIRA)

Análise da CNH nos logs OCR:
- **19:48** — OCR rodou com sucesso, retornou `cpf: "685.186.507-63"` (CPF matematicamente válido — passa no dígito verificador). Log: `[OCR] CPF extraído validado com sucesso: 685.186.507-63`.
- **19:26** — Primeira tentativa de envio (já fora do retention dos logs), provavelmente o OCR retornou um CPF com dígito inválido OU `"ilegivel"`.

A função `document-ocr` está funcionando corretamente — inclusive com retry, permutação de dígitos confundíveis e validação por checksum.

### Bug real

Em `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`, o componente já tem toda a lógica de **CPF manual** preparada:

- Linha 173: `cpfEfetivo = cpfManual || (cpfIlegivel ? '' : dadosExtraidos.cpf)` — combina manual com OCR.
- Linha 175: `cpfValido = validateCPF(cpfLimpoEfetivo)` — valida o efetivo.
- Linha 191: `podeAvancar` usa `cpfValido` corretamente.
- Linhas 659+: campo de input "CPF (corrigir manualmente)" que aparece quando OCR é ilegível/inválido.

**Mas no `handleSubmit` (linhas 408–414) a validação ignora o CPF manual** e olha apenas `dadosExtraidos.cpf` (o que veio do OCR):

```ts
const cpfExtraido = dadosExtraidos.cpf || '';   // ❌ só OCR
const cpfLimpo = cpfExtraido.replace(/\D/g, '');
if (!cpfLimpo || !validateCPF(cpfLimpo)) {
  toast.error('O CPF extraído do documento é inválido...');
  return;
}
```

Resultado: usuário corrige o CPF no campo manual, o badge fica verde ("CPF válido"), botão "Continuar" habilita, mas ao clicar **o toast vermelho aparece** (visto no print) porque a validação do submit ainda compara o CPF original do OCR.

### Correção

Trocar a validação do `handleSubmit` para usar `cpfLimpoEfetivo`/`cpfValido` (que já consideram o CPF manual), com mensagem de erro mais clara distinguindo entre "OCR inválido" e "manual inválido".

```ts
if (!cpfLimpoEfetivo || !validateCPF(cpfLimpoEfetivo)) {
  toast.error(
    cpfManual
      ? 'O CPF digitado é inválido. Verifique os dígitos antes de continuar.'
      : 'O CPF extraído do documento é inválido. Corrija manualmente no campo "CPF" antes de continuar.'
  );
  return;
}
```

### Detalhes técnicos
- 1 arquivo alterado: `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx` (linhas 408–414).
- Nenhuma mudança no banco, edge function ou hook.
- Sem regressão: a lógica de habilitar/desabilitar o botão Continuar (`podeAvancar`) já usava o CPF efetivo — só o gate final do submit estava errado.

### Bonus opcional (sugiro NÃO fazer agora, pergunta antes)
Posso também adicionar logs no `handleSubmit` quando o CPF for diferente do OCR (audit trail), mas isso é melhoria futura — não impede a correção.
