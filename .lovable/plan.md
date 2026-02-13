

# Fix: Redirecionamento 404 apos criar OS

## Problema
Apos criar a OS com sucesso pelo dialog "Enviar para Oficina", o sistema redireciona para `/operacoes/ordens-servico`, mas essa rota nao existe. A rota correta e `/ordens-servico` (conforme registrada no `App.tsx`).

## Alteracao

**Arquivo: `src/pages/eventos/SinistroAnalise.tsx`** (linha 714)

Corrigir a rota no `onSuccess` do `EnviarParaOficinaDialog`:

```
// De:
onSuccess={() => navigate('/operacoes/ordens-servico')}

// Para:
onSuccess={() => navigate('/ordens-servico')}
```

Uma unica linha a ser alterada.

