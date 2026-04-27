## Problema (root cause confirmado nos logs)

Ao clicar em **"Gerar Link"** para atribuir o prestador *Kleytonn* a uma Instalação, a edge function `gerar-link-prestador` falha com:

```
PGRST204 — Could not find the 'vistoriador_prestador_id' column
of 'instalacao_prestador_links' in the schema cache
```

A tabela `instalacao_prestador_links` só tem a coluna `prestador_id`. Mas a função, desde que foi adicionado suporte a `vistoriadores_prestadores`, escolhe dinamicamente o nome da coluna:

```ts
const colunaPrestador = usaVistoriadorPrestador
  ? 'vistoriador_prestador_id'   // ❌ não existe nesta tabela
  : 'prestador_id'
```

Como o prestador *Kleytonn* está cadastrado em `vistoriadores_prestadores`, a função tenta inserir `vistoriador_prestador_id` → erro 500 → o front mostra "Edge Function returned a non-2xx status code".

A coluna `vistoriador_prestador_id` só existe em `vistoria_prestador_links` (fluxo de vistoria), não em `instalacao_prestador_links` (fluxo de instalação).

## Correção (mínima e cirúrgica)

Em `supabase/functions/gerar-link-prestador/index.ts` (apenas o fluxo de **instalação**) sempre usar a coluna `prestador_id`, independentemente da tabela de origem do prestador. O `id` é o mesmo (o bloco já faz `upsert` espelhando em `vistoriadores_prestadores` quando vem de `prestadores_instalacao`), então gravar em `prestador_id` continua íntegro.

Mudanças:

1. **SELECT do link existente** (linha ~107): trocar
   ```ts
   .eq(colunaPrestador, prestadorIdFinal)
   ```
   por
   ```ts
   .eq('prestador_id', prestadorIdFinal)
   ```

2. **INSERT do novo link** (linha ~117–122): substituir o uso dinâmico por:
   ```ts
   const insertPayload = {
     instalacao_id,
     prestador_id: prestadorIdFinal,
     valor,
     atribuido_por,
   }
   ```

3. **Mensagem de erro mais útil**: incluir `linkErr.message` no JSON de resposta para evitar futuros 500 silenciosos.

4. Marcar o relato de erro como **em_tratamento** ao iniciar e **concluido** ao terminar (conforme padrão pedido pela diretoria).

## Arquivos afetados

- `supabase/functions/gerar-link-prestador/index.ts` — ajustar coluna e mensagem de erro
- migração SQL para mover relato(s) abertos sobre "atribuir prestador" para `em_tratamento` → `concluido`

## Não muda

- Fluxo de vistoria (`gerar-link-vistoriador-prestador`) — esse já usa a tabela correta `vistoria_prestador_links` que de fato possui `vistoriador_prestador_id`.
- Front-end (`AtribuirPrestadorPopover`, `useAtribuicaoManual`) — chamada continua igual.

## Teste após o deploy

1. Abrir `/monitoramento/servicos-campo` → aba Atribuição.
2. Clicar no botão laranja de prestador externo em uma instalação pendente.
3. Selecionar *Kleytonn*, valor opcional, **Gerar Link** → deve abrir o `LinkPrestadorResultDialog` com a URL pública.
