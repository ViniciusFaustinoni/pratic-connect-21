## Causa raiz

`src/pages/cadastro/VistoriaCompletaAnalise.tsx` (linhas 225–239) busca o serviço negado **sem escopo nenhum**:

```ts
.from('servicos')
.select('id, decisao_instalador, ressalvas_instalador, fotos_ressalva, veiculo_id, associado_id')
.eq('tipo', 'instalacao')
.eq('decisao_instalador', 'negado')
.limit(1);
```

Não filtra por `instalacao_origem_id`, nem por `associado_id`, nem por `veiculo_id`. Resultado: enquanto existir **qualquer** serviço negado no banco, ele é injetado em **toda** página `/cadastro/instalacoes/:id/ativar`.

Confirmado no banco: hoje há exatamente um registro `decisao_instalador='negado'` — moto RKL6I08 (Honda CG 160, JOAO VICTOR PEREIRA, instalação `3cbd44ea-4f92-…`). Por isso, ao abrir a ativação de THAYSSA (TDC6E30) ou qualquer outra, o banner exibe placa, motivo e foto da moto do João — corpo da página continua sendo do associado aberto, gerando a confusão.

## Correção

Em `VistoriaCompletaAnalise.tsx`, escopar a query `servico-recusa-instalacao`:

- Filtrar por `instalacao_origem_id = id` (param da rota = id da instalação aberta).
- Adicionar `status = 'em_analise'` para ignorar negativas já resolvidas/realocadas.
- Trocar `.limit(1)` + `data[0]` por `.maybeSingle()`.

Trecho-alvo:

```ts
const { data } = await supabase
  .from('servicos')
  .select('id, decisao_instalador, ressalvas_instalador, fotos_ressalva, veiculo_id, associado_id, instalacao_origem_id, status')
  .eq('tipo', 'instalacao')
  .eq('decisao_instalador', 'negado')
  .eq('instalacao_origem_id', id)
  .eq('status', 'em_analise')
  .maybeSingle();
return data;
```

Defensivo extra (renderização do banner): só renderizar `temRecusaPendente` quando `servicoRecusa.instalacao_origem_id === id`, garantindo que mesmo que a query mude no futuro, o card nunca extravase de contexto.

## Validação

1. Abrir as 3 ativações pendentes hoje (TDC6E30 / RIR1B37 / KRX9802) → nenhum banner vermelho de "NEGADO".
2. Abrir a instalação real de RKL6I08 → banner continua aparecendo com motivo, fotos e botão "Tomar Decisão" funcionando normalmente.
3. Cabeçalho ("Ativação de Rastreador — placa • nome") deixa de exibir o veículo errado.

Sem migração de dados; o registro negado de RKL6I08 segue válido e visível apenas no contexto correto.
