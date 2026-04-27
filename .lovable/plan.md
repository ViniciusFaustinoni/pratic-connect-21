## Diagnóstico

Bug confirmado em `src/components/diretoria/DetalheRelatoModal.tsx`.

O modal de detalhe de relato é montado **uma única vez** na página `RelatosErros.tsx` (linha 333) — apenas a prop `report` muda quando o diretor clica em outro relato. Mas o estado interno `obs` (`useState('')`) **nunca é resetado** entre relatos.

Além disso, na função `onMelhorar`:
```ts
const base = obs.trim() || report.descricao;
```
Ela usa o conteúdo do textarea "Observação para o autor" como entrada da IA. Se esse textarea ainda contém o texto melhorado de um relato anterior (porque o estado não foi limpo), a IA recebe esse texto e devolve uma versão refinada dele — exatamente o sintoma descrito ("retorna um texto de outro relato").

A edge function `melhorar-texto-relato-erro` está correta: busca o relato pelo `report_id` correto, mas **prioriza o `texto` enviado pelo cliente** (linha 56: `const textoBase = (textoOpcional ?? report.descricao ?? '').trim()`). Como o cliente sempre envia o `obs` contaminado, o texto correto do banco é ignorado.

## Correção

### 1. Resetar estado ao trocar de relato
Em `DetalheRelatoModal.tsx`, adicionar `useEffect` que limpa `obs`, `obsPrev` e `preview` sempre que `report?.id` mudar:
```tsx
useEffect(() => {
  setObs('');
  setObsPrev(null);
  setPreview(null);
}, [report?.id]);
```

### 2. "Melhorar com IA" deve usar a descrição do relato como fonte de verdade
Quando o diretor clica em "Melhorar com IA" sem ter digitado nada, a base deve ser **sempre** `report.descricao` (texto original do autor), não o textarea. O textarea é destino, não fonte.

Trocar `onMelhorar`:
```ts
const onMelhorar = async () => {
  if (!report) return;
  // Sempre melhora a DESCRIÇÃO do relato atual, não o que está no campo de observação
  const novo = await melhorarTexto.mutateAsync({
    reportId: report.id,
    texto: report.descricao,
  });
  if (novo) {
    setObsPrev(obs);
    setObs(novo);
    toast.success('Texto melhorado pela IA', {
      action: { label: 'Desfazer', onClick: () => setObs(obsPrev ?? '') },
    });
  }
};
```

Isso garante que a IA sempre opere sobre o texto correto do relato em foco, independente do que esteja (ou tenha ficado) no textarea.

## Arquivos afetados
- `src/components/diretoria/DetalheRelatoModal.tsx`

## Resultado esperado
- Ao abrir um novo relato, o campo "Observação para o autor" começa vazio.
- "Melhorar com IA" sempre devolve uma versão refinada da descrição **do relato atualmente aberto**, nunca de outro.
