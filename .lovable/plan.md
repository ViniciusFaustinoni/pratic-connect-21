## Diagnóstico

A tela `/eventos/chat-ia` mostra 282 conversas, mas o banco tem **480 telefones distintos** / 2807 mensagens. Faltam ~197 conversas.

Causa, em `src/pages/eventos/EventosChatIA.tsx`:

1. **Filtro de instância exclui mensagens sem `instancia_id`.** A query usa `.in('instancia_id', instanciasAtivas)` (linha 47). Existem **1872 mensagens (278 telefones distintos) com `instancia_id IS NULL`** — webhooks/disparos antigos que gravaram sem amarrar à instância. O `.in()` do PostgREST descarta tudo que é NULL.
2. **`.limit(1000)` nas mensagens** (linha 45). Hoje ainda não corta (as instâncias ativas têm 936 msgs), mas vai cortar conversas conforme o volume crescer — a lista é construída a partir das mensagens, então mensagens fora do limite somem.

As duas instâncias do banco (`Principal/evolution` e `Meta WhatsApp/meta`) estão **ambas ativas** — não é caso de instância desativada.

## Mudança

Editar **somente** o `useQuery` de `chat-ia-conversas` em `src/pages/eventos/EventosChatIA.tsx`:

- Trocar `.in('instancia_id', instanciasAtivas)` por filtro `or` que aceita `instancia_id.is.null` **ou** `instancia_id.in.(...)`. Assim mensagens órfãs aparecem na lista.
- Subir o `.limit(1000)` para `5000` (ou paginar) para acomodar o volume real (2807 hoje) com folga.
- Atualizar a `queryKey` para refletir a nova lógica.

Nenhuma outra tela, edge function ou backend é afetada — é só a query do painel `Conversas IA`. O `ChatPanel` (que mostra o histórico ao clicar numa conversa) já busca por telefone, então conversas órfãs passam a abrir normalmente.

## Detalhes técnicos

```ts
// antes
if (instanciasAtivas && instanciasAtivas.length > 0) {
  q = q.in('instancia_id', instanciasAtivas);
}

// depois
if (instanciasAtivas && instanciasAtivas.length > 0) {
  q = q.or(`instancia_id.is.null,instancia_id.in.(${instanciasAtivas.join(',')})`);
}
```

E `.limit(1000)` → `.limit(5000)`.

Realtime (linhas 81-90) também deve aceitar `inst == null` para invalidar a query quando chega mensagem órfã nova.

## Confirme antes de eu executar

Quer que eu **inclua** as mensagens com `instancia_id IS NULL` (mostra as 480 conversas reais) ou prefere que eu **faça um backfill** ligando essas 1872 mensagens órfãs à instância correta (`Principal` evolution / `Meta WhatsApp`) e mantenha o filtro estrito? O segundo caminho é mais limpo a longo prazo mas exige saber por que essas mensagens estão sem instância (provavelmente um webhook antigo).