## Objetivo
Fechar o furo de segurança em que `criar-solicitacao-troca-titularidade` aceita qualquer combinação `associado_antigo_id` + `veiculo_id` vinda do frontend, permitindo criar troca para placa que não pertence ao associado.

## Mudança única — `supabase/functions/criar-solicitacao-troca-titularidade/index.ts`

Logo após o `SELECT` do veículo (que já existe nas linhas 64–69), adicionar `associado_id` ao select e validar:

```ts
if (veiculo.associado_id !== associado_antigo_id) {
  return new Response(
    JSON.stringify({ error: 'A placa informada não pertence ao titular antigo.' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
```

A validação roda **antes** do guard de placa bloqueada, do INSERT da cotação, do INSERT da solicitação e do disparo automático do termo. Se falhar: nada é criado, nada é disparado.

## Por que essa abordagem
- A coluna `veiculos.associado_id` já é a fonte da verdade do vínculo (mantida pelo trigger `veiculo-associado-sync` — ver memória "Veículo segue contrato"). Não precisa join em `contratos` nem reimplementar lógica.
- Não existe helper reutilizável de "placa pertence ao CPF" — a validação direta pela FK é o caminho mais limpo e barato.
- HTTP **403** porque é violação de autorização sobre o recurso, não erro de validação de input.

## Fora de escopo (intocado)
- Fluxo da IA (`efetivar-troca-titularidade` + `chat_solicitacoes_ia`).
- UI do `TrocaTitularidadeDialog` — validação client-side fica como está.
- Demais edges de troca (aprovar/reprovar/efetivar).

## Comportamento esperado
- Consultor tenta criar troca via UI normal: continua funcionando (UI já filtra veículos do associado).
- Chamada direta na edge com placa de outro dono: HTTP 403, mensagem clara, sem efeitos colaterais.
- Solicitações antigas: não impactadas.
