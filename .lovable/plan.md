
# Envio automatico ao SGA apos ativacao do contrato

## Problema

Quando um contrato e ativado (botao "Ativar Contrato"), o sistema atualiza o status do contrato e do associado para "ativo", mas **nao envia os dados automaticamente para o SGA Hinova**. O envio e feito apenas manualmente, pelo botao "Enviar para SGA" no card do contrato ativado. Se ninguem clicar nesse botao, o associado e veiculo nunca chegam ao SGA.

## Causa raiz

A funcao `useAtivarContrato` em `src/hooks/useAtivacoes.ts` (linha 251-301) faz apenas:
1. Atualiza contrato para status "ativo"
2. Atualiza associado para status "ativo"

Nao existe nenhuma chamada a `sga-hinova-sync` nesse fluxo.

## Solucao

Adicionar a chamada automatica da edge function `sga-hinova-sync` ao final do processo de ativacao em `useAtivarContrato`. O envio ao SGA sera feito de forma **nao-bloqueante** (fire-and-forget) para nao travar a ativacao caso o SGA esteja fora do ar.

### Alteracoes

**Arquivo:** `src/hooks/useAtivacoes.ts`

Na funcao `useAtivarContrato`, apos ativar o contrato e o associado (linha ~289), adicionar:

1. Buscar o `veiculo_id` do associado
2. Chamar `supabase.functions.invoke('sga-hinova-sync')` com o `veiculo_id` e `associado_id`
3. Se o envio falhar, apenas logar o erro (toast de aviso), sem impedir a ativacao

```
// Pseudocodigo da alteracao:
// Apos ativar contrato e associado...

// 4. Enviar automaticamente ao SGA (fire-and-forget)
if (contrato?.associado_id) {
  // Buscar veiculo do associado
  const { data: veiculo } = await supabase
    .from('veiculos')
    .select('id, sincronizado_hinova')
    .eq('associado_id', contrato.associado_id)
    .eq('sincronizado_hinova', false)
    .limit(1)
    .maybeSingle();

  if (veiculo) {
    // Enviar ao SGA em background (nao bloqueia ativacao)
    supabase.functions.invoke('sga-hinova-sync', {
      body: {
        veiculo_id: veiculo.id,
        associado_id: contrato.associado_id,
      },
    }).then(({ data, error }) => {
      if (error || !data?.success) {
        console.warn('[Ativacao] Falha ao enviar ao SGA:', error || data?.error);
        toast.warning('Contrato ativado, mas envio ao SGA falhou. Use o botao manual.');
      } else {
        toast.success('Enviado ao SGA automaticamente!');
      }
    }).catch(err => {
      console.warn('[Ativacao] Erro ao enviar ao SGA:', err);
    });
  }
}
```

### Comportamento esperado

- Ao clicar "Ativar Contrato", o sistema ativa e ja envia ao SGA automaticamente
- Se o SGA estiver indisponivel ou der erro, a ativacao continua normalmente e aparece um aviso
- O botao manual "Enviar para SGA" continua disponivel como fallback

### Arquivos alterados

- `src/hooks/useAtivacoes.ts` (funcao `useAtivarContrato`, adicionar chamada ao SGA)
