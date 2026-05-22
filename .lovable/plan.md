## Diagnóstico

O template Meta `troca_titularidade_aprovada_v2` é disparado em `supabase/functions/efetivar-troca-titularidade/index.ts:931-945`:

```ts
template_params: [primeiroNomeNovo, veiculoLabel]
// veiculoLabel = `${marcaVeiculo} ${modeloVeiculo} ${placaVeiculo}`
```

`marcaVeiculo`, `modeloVeiculo` e `placaVeiculo` vêm de `veiculoData`, lido aqui:

```ts
// linha 612-616
const { data: veiculoData } = await supabase
  .from("veiculos")
  .select("placa, marca, modelo, ano, cor, chassi, renavam, valor_fipe")
  .eq("id", veiculoId).maybeSingle();
```

**A coluna `veiculos.ano` não existe** — a tabela tem `ano_fabricacao` e `ano_modelo`. O PostgREST retorna erro, `veiculoData` fica `null`, e os fallbacks resolvem para `marca=""`, `modelo=""`, `placa="N/A"` → mensagem fica "veículo N/A foi APROVADA" (exatamente o screenshot).

A mesma `select` errada aparece na linha 90 (bloco de retry SGA). Além disso, a linha 622 grava `contratoData.veiculo_ano = veiculoData.ano` (também ficaria `undefined`).

## Mudanças

### `supabase/functions/efetivar-troca-titularidade/index.ts`

1. **Linha 90** — trocar `ano` por `ano_fabricacao, ano_modelo` no select do bloco SGA retry.

2. **Linha 614** — mesmo ajuste no select principal:
   ```ts
   .select("placa, marca, modelo, ano_fabricacao, ano_modelo, cor, chassi, renavam, valor_fipe")
   ```

3. **Linha 622** — mapear corretamente para o snapshot do contrato:
   ```ts
   contratoData.veiculo_ano = veiculoData.ano_modelo;
   ```
   (e, se existir coluna `veiculo_ano_fabricacao` em contratos, popular também — verificar no momento da implementação).

### Fora do escopo
- Sem migração de dados — mensagens já enviadas erradas ficam no histórico (não há reenvio automático).
- Demais templates de troca (`reprovada_v2`, `termo_pendente_v2`, `solicitada`) não dependem dessa query — não precisam de mudança.

## Verificação
- Após o deploy, disparar uma efetivação de troca de titularidade (ou usar `supabase--curl_edge_functions` em ambiente de teste) e confirmar que o WhatsApp do novo titular chega com `MARCA MODELO PLACA` correto.
- Olhar logs `edge_function_logs efetivar-troca-titularidade` para confirmar ausência do erro PostgREST de coluna inexistente.