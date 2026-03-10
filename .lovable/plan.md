

# Fix: "Aguardando Monitoramento" aparecendo após monitoramento já ter aprovado

## Problema

Quando o monitoramento já aprovou a ressalva (`decisao_instalador = 'aprovado_ressalva'`), ao avançar do checklist (etapa 2→3) com itens NOK, o dialog de condição reaparece com o botão "Enviar para Monitoramento". Se o instalador clica nesse botão, a tela de espera aparece novamente — sendo que a análise já foi feita.

## Solução

No `InstaladorChecklist.tsx`, duas mudanças:

### 1. Pular o dialog quando monitoramento já aprovou

Na função `avancar()` (linha ~718-726), adicionar condição: se `servico.decisao_instalador === 'aprovado_ressalva'`, pular o dialog e avançar direto (a ressalva já foi tratada).

```text
if (etapaAtual === 2 && temItensNok) {
  // Se monitoramento já aprovou, não mostrar dialog novamente
  if (servico?.decisao_instalador === 'aprovado_ressalva') {
    await salvarEAvancar();
    return;
  }
  setShowDialogCondicao(true);
  return;
}
```

### 2. Ocultar botão "Enviar para Monitoramento" no dialog (segurança extra)

No dialog de condição (linha ~2112), esconder o botão "Enviar para Monitoramento" se `servico.decisao_instalador === 'aprovado_ressalva'`, como proteção contra exibição indevida do dialog por outros caminhos.

| Arquivo | Alteração |
|---|---|
| `src/pages/instalador/InstaladorChecklist.tsx` | Pular dialog se monitoramento já decidiu + ocultar botão "Enviar para Monitoramento" quando já aprovado |

