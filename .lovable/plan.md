

## Causa raiz — por que não houve agendamento de instalação

### O que aconteceu com o WILLIAM

O contrato `d96300ef…` é da **Honda XRE 300, placa LSP3E65**, com **valor FIPE = R$ 14.736**.

Na função `aprovar-proposta` (linha 12–21):

```ts
function precisaRastreador(valorFipe, fipeMinimo, _tipoVeiculo='automovel', fipeMinimoMoto?) {
  const limite = _tipoVeiculo === 'moto' ? fipeMinimoMoto : fipeMinimo;
  if (valorFipe <= 0) return true;
  return valorFipe >= limite;
}
```

E a chamada (linha 160):

```ts
const veiculoPrecisaRastreador = precisaRastreador(valorFipe, fipeMinRastreador, 'automovel', fipeMinRastreadorMoto);
```

**O tipo está hardcoded como `'automovel'`**. Resultado para a XRE 300:
- limite usado = R$ 30.000 (limite de **carros**)
- 14.736 < 30.000 → **`precisaRastreador = false`**
- → ativa Proteção 360° **sem rastreador** e **não cria instalação** (linha 208 nem entra)
- → veículo vira `cobertura_total=true`, contrato `ativo`, associado `ativo` ✅
- → mas **moto sem rastreador** quando deveria ser **obrigatório a partir de R$ 9.000** (memória `tracker-eligibility-and-contract-logic-v2`)

A regra correta (memória do projeto):
> Rastreador obrigatório para **Diesel**, **Carros FIPE ≥ R$ 30.000** e **Motos FIPE ≥ R$ 9.000**.

A XRE 300 (R$ 14.736) é moto e ultrapassa R$ 9.000 → **deveria ter exigido rastreador e gerado instalação**, mas a função tratou como carro de baixo valor.

### O segundo veículo (Meriva LUQ0573, R$ 22.230)

Mesmo problema: é carro, FIPE < R$ 30.000, então também ficou Proteção 360° sem rastreador. Aqui está **correto** pela regra (carro abaixo do limite). Curiosamente o veículo está com `cobertura_total=false` e `cobertura_roubo_furto=false` — a função `aprovar-proposta` só atualiza **um** veículo (`veiculos[0]`, linha 156), ignorando os demais do associado. Outro bug menor, mas é cenário multi-veículo.

---

## Correção

**Arquivo:** `supabase/functions/aprovar-proposta/index.ts`

### Mudança 1 — detectar tipo de veículo (carro vs moto)

Adicionar query para descobrir o tipo via `marcas_modelos` (memória `vehicle-type-detection-source`) ou fallback por `combustivel/categoria`. Substituir o `'automovel'` hardcoded pela detecção real.

```ts
// Buscar tipo do veículo (carro/moto) via marcas_modelos
const { data: tipoVeic } = await supabase
  .from('marcas_modelos')
  .select('tipo_veiculo')
  .eq('codigo_fipe', veiculo.codigo_fipe)
  .maybeSingle();

const tipoVeiculo = tipoVeic?.tipo_veiculo === 'moto' ? 'moto' : 'automovel';
const veiculoPrecisaRastreador = precisaRastreador(valorFipe, fipeMinRastreador, tipoVeiculo, fipeMinRastreadorMoto);
```

(Confirmar nome da coluna em `marcas_modelos` — pode ser `tipo`, `categoria` ou similar — durante implementação.)

### Mudança 2 — processar TODOS os veículos do associado, não só o primeiro

Trocar `const veiculo = veiculos[0]` por `for (const veiculo of veiculos)` e replicar a lógica de:
- decisão de rastreador
- update de status/cobertura
- criação de instalação se necessário

Isso garante que cadastros multi-veículo (como o do William) tenham cada veículo tratado individualmente.

### Mudança 3 — corrigir retroativamente o caso WILLIAM

Migration única para:
1. **XRE 300 (LSP3E65)**: marcar como `instalacao_pendente`, `cobertura_total=false`, e criar uma `instalacao` com `status='agendada'` para hoje (manhã, endereço do associado).
2. **Meriva (LUQ0573)**: ativar `cobertura_roubo_furto=true` e `cobertura_total=true` (carro < R$ 30k → Proteção 360° sem rastreador, conforme regra).
3. Inserir entrada em `associados_historico` documentando a correção.

### Validação pós-correção

1. Buscar WILLIAM em `/monitoramento/vistorias-instalacoes-mon` → deve aparecer instalação agendada da XRE 300.
2. Tela `/cadastro/associados` busca por "LSP3E65" → veículo deve mostrar status `instalacao_pendente`.
3. Aprovar uma nova proposta de teste com **moto FIPE entre R$ 9k e R$ 30k** → deve criar instalação automaticamente.
4. Aprovar uma nova proposta com **2 veículos** → ambos devem receber tratamento correto.

---

## Resumo executivo (não-técnico)

A aprovação do WILLIAM foi concluída com sucesso, mas a função que decide "esse veículo precisa de rastreador?" tratou a moto dele como se fosse um carro. Pela regra da empresa, motos acima de R$ 9 mil exigem rastreador; carros só acima de R$ 30 mil. Como o sistema usou o limite de carro (R$ 30k), a moto de R$ 14.736 foi considerada "isenta" e nenhuma instalação foi agendada — daí ele não aparece no monitoramento. Vamos corrigir a lógica para detectar carro vs moto, processar todos os veículos do contrato (ele tem dois) e regularizar o cadastro do William criando o agendamento de instalação que ficou faltando.

