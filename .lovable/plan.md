# Bug: Onix detectado como moto no checklist do instalador

## Diagnóstico

Carlos Roberto Alves possui um **Chevrolet Onix 10mt Lt2** (placa RJM3D69, confirmado no banco). No app do instalador aparece o badge "Checklist de Moto (10 fotos)".

A causa está em `src/data/vistoriaConfigCompleta.ts` → função `detectarTipoVeiculo` (linha 865), que faz:

```ts
const modeloLower = ` ${modelo.toLowerCase()} `;
if (MOTO_KEYWORDS.some(kw => modeloLower.includes(kw))) return 'moto';
```

A lista `MOTO_KEYWORDS` contém tokens curtos como `'mt '`, `'mt-'`, `'cg '`, `'cb '`, `'sh '`, `'dl '`, `'jet'`, `'next'`, `'elite'`, `'adv'`, `'fan'`, `'pop'`, `'yes'`. Como o match é por substring, o modelo `" onix 10mt lt2 "` casa com `"mt "` (dentro de `"10mt "`) e retorna `moto`. O parâmetro `marca` é ignorado (`_marca`), então marcas exclusivamente automotivas como Chevrolet não barram o falso positivo.

Esse mesmo bug afeta qualquer modelo de carro que tenha `mt`/`at` colado a número (`1.0mt`, `16v`, `2.0at`), `next`/`elite`/`jet`/`adv` no nome (ex: VW Nivus Highline, Fiat Strada Adventure, etc.).

## Correção

### 1. `src/data/vistoriaConfigCompleta.ts` — endurecer `detectarTipoVeiculo`

- Adicionar lista `CARRO_BRANDS` com marcas exclusivamente automotivas: Chevrolet, GM, Volkswagen, VW, Fiat, Ford, Toyota, Hyundai, Renault, Peugeot, Citroën/Citroen, Jeep, Nissan, Mitsubishi, Kia, Audi, Mercedes-Benz, Volvo, Land Rover, Porsche, Subaru, Mazda, Chery, Caoa Chery, Ram, Dodge, Jaguar, Mini, Lexus, JAC, GWM, BYD, Smart, Troller, Iveco.
- Se `marca` (normalizada, uppercase, trim) bater com `CARRO_BRANDS` → retornar `'automovel'` imediatamente, antes de avaliar keywords.
- Substituir `includes(kw)` por regex com **word boundaries** para os keywords ambíguos: usar `new RegExp("\\b" + kw.trim() + "\\b", "i")`. Isso impede que `mt` case com `10mt` e que `cg` case com palavras maiores.
- Manter o caminho rápido por `tipoVeiculoStr` (API de placa) intacto — ele é o sinal mais confiável.

### 2. Sem migration

Não há dado persistido errado a corrigir. O `tipo_veiculo` do veículo no banco está vazio (não existe coluna populada erroneamente — a função roda no cliente em cada render). Assim que o instalador atualizar a tela, o checklist passa a mostrar "Checklist de Veículo" com as fotos corretas de carro.

## Fora de escopo

- Não tocar no fluxo de autovistoria (já estável após o fix anterior).
- Não alterar o hook `useDetectarTipoVeiculo` (ele já consulta primeiro a tabela `marcas_modelos` e só cai no fallback síncrono em último caso). O bug é exclusivo do fallback síncrono usado pelo `InstaladorChecklist`.

## Validação

- Testes mentais: `detectarTipoVeiculo(undefined, 'onix 10mt Lt2', 'Chevrolet')` → `'automovel'`. `detectarTipoVeiculo(undefined, 'CG 160 Titan', 'Honda')` → `'moto'` (Honda não está em `CARRO_BRANDS`, e `'cg'` casa via word boundary). `detectarTipoVeiculo('MOTOCICLETA', 'XRE 300', 'Honda')` → `'moto'`.
