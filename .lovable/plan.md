# Correção: "Tipo: Automóvel" no Termo de Filiação

## Diagnóstico

O termo está renderizado pelo template HTML em `supabase/functions/_shared/termo-afiliacao-template.ts`. Na linha 452 ele imprime:

```ts
<span class="field-value">${data.veiculo.tipo_veiculo || 'Carro'}</span>
```

Isto lê `data.veiculo.tipo_veiculo` **cru**, exatamente como veio de `marcas_modelos`/API de placa (que devolve `"Automóvel"` como categoria oficial do DENATRAN). Ou seja: **o template ignora o normalizador canônico** que já existe em `_shared/template-utils.ts`.

Para piorar, o próprio normalizador (`template-utils.ts` linhas 182-190 — chave `veiculo.tipo`) também está mapeando "carro / automovel / vazio" → **"Automóvel"**, contrariando a regra de produto ("Carro" ou "Motocicleta").

Resultado: qualquer caminho — placeholder `{{veiculo.tipo}}` no editor Autentique **ou** render HTML direto — devolve "Automóvel".

Observação cruzada:
- `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx` já normaliza certo (`'Motocicleta' : 'Carro'`).
- `src/components/cadastro/TermoFiliacaoTemplate.tsx` (preview React do termo) usa `'Moto' : 'Carro'` — só falta padronizar para "Motocicleta".

Não é problema de dados; é só renderização inconsistente.

## Plano de correção (3 arquivos, mudança puramente de apresentação)

### 1. `supabase/functions/_shared/template-utils.ts` (linhas 182-190)
Trocar fallback de `"Automóvel"` por `"Carro"`. Manter detecção de moto/utilitário/caminhão.

```ts
'veiculo.tipo': (() => {
  const raw = ((dados.veiculo as any).tipo_veiculo || '').toString().trim().toLowerCase();
  if (raw === 'moto' || raw === 'motocicleta' || raw === 'ciclomotor' || raw === 'triciclo') return 'Motocicleta';
  if (raw === 'utilitario' || raw === 'utilitário') return 'Utilitário';
  if (raw === 'caminhao' || raw === 'caminhão') return 'Caminhão';
  // 'carro', 'automovel', 'automóvel', 'passeio', vazio → Carro
  return 'Carro';
})(),
```

### 2. `supabase/functions/_shared/termo-afiliacao-template.ts` (linha 451-453)
Aplicar a mesma normalização no HTML, em vez de imprimir `data.veiculo.tipo_veiculo` cru:

```ts
<span class="field-value">${(() => {
  const raw = (data.veiculo.tipo_veiculo || '').toString().trim().toLowerCase();
  if (raw === 'moto' || raw === 'motocicleta' || raw === 'ciclomotor' || raw === 'triciclo') return 'Motocicleta';
  return 'Carro';
})()}</span>
```

(Manter a lógica de Portas escondidas para moto — já existe em linha 460-471 e usa `tipo === 'moto'`; com a normalização acima, fazer ele comparar com `'motocicleta'` também, ou já comparar pelo `raw` antes de formatar.)

### 3. `src/components/cadastro/TermoFiliacaoTemplate.tsx` (linha ~255)
Trocar `'Moto'` por `'Motocicleta'` para casar com o termo final:

```tsx
<span style={{ fontWeight: 'bold' }}>Tipo:</span> {veiculo.tipo === 'moto' ? 'Motocicleta' : 'Carro'}
```

## O que NÃO muda

- Nada no banco. `marcas_modelos.tipo_veiculo` segue com o vocabulário do DENATRAN ("Automóvel"); a memória `mem://logic/operations/catalogo-marcas-modelos-divergente` continua valendo.
- Detector `useDetectarTipoVeiculo` (`'carro' | 'moto'`) e fluxos de vistoria/autovistoria não são tocados.
- Nenhuma edge function de geração de contrato/Autentique muda lógica — só rótulo.

## Validação

1. Regerar o termo para um contrato de carro → deve mostrar "Tipo: Carro".
2. Regerar o termo para um contrato de moto (ex.: Marllon KRF8B74) → deve mostrar "Tipo: Motocicleta" e ocultar Portas.
3. Conferir pré-visualização da proposta (`PropostaDetalhesTabs`) já existente — sem regressão.

Pronto para implementar quando aprovado.