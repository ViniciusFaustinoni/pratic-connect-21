
# Corrigir status "Aguardando auto vistoria" quando link ja foi completado

## Problema

Na pagina do analista (`SinistroAnalise.tsx`), a secao "Acoes" verifica apenas `sinistro.status === 'em_analise'` (linha 824) e exibe fixamente "Aguardando auto vistoria -- link enviado ao associado". Porem, quando o associado completa todas as 3 etapas, o `sinistro_evento_links.status` muda para `"completado"`, mas o `sinistros.status` permanece `"em_analise"`. Resultado: o analista ve "Aguardando" mesmo com tudo ja enviado.

## Solucao

Dentro do bloco `sinistro.status === 'em_analise'` (linha 824), verificar se o link do evento ja foi completado. Se sim, exibir uma mensagem diferente informando que a documentacao foi recebida e que o evento esta pronto para analise.

### Arquivo: `src/pages/eventos/SinistroAnalise.tsx`

Alterar o bloco nas linhas 823-833:

**Logica atual:**
```
if (sinistro.status === 'em_analise') {
  return "Aguardando auto vistoria — link enviado ao associado."
}
```

**Logica corrigida:**
```
if (sinistro.status === 'em_analise') {
  // Verificar se o link ja foi completado usando linkAtivo do hook useEventoLink
  if (linkAtivo?.status === 'completado') {
    return mensagem verde: "Documentacao recebida — pronto para analise."
  } else {
    return mensagem amarela: "Aguardando auto vistoria — link enviado ao associado."
  }
}
```

O hook `useEventoLink` ja esta sendo usado na pagina e retorna `linkAtivo` com o status do link mais recente.

### Detalhes tecnicos

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/eventos/SinistroAnalise.tsx` | Linhas 823-833: dentro do bloco `em_analise`, verificar `linkAtivo?.status === 'completado'` e exibir mensagem verde "Documentacao recebida" com icone CheckCircle em vez de "Aguardando auto vistoria" |

Apenas uma verificacao condicional adicional. Nenhuma nova dependencia ou tabela necessaria.
