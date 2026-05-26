# Bug Softruck — Cor PRETA / BRANCA virando CINZA

## Dimensionamento real (executado agora no banco)

Query: `SELECT cor, COUNT(*) FROM veiculos WHERE softruck_vehicle_id IS NOT NULL GROUP BY cor`.

**Veículos hoje no painel da Softruck com cor caindo no fallback cinza (`#9E9E9E`):**

| Cor no CRM | Veículos | Hex enviado hoje | Hex correto |
|---|---:|---|---|
| BRANCA | **1.176** | #9E9E9E (cinza) | #FFFFFF |
| PRETA | 10 | #9E9E9E | #212121 |
| VERMELHA | 5 | #9E9E9E | #FF5722 |
| BRANCA PEROLIZADA | 2 | #9E9E9E | #FFFFFF |
| FANTASIA | 2 | #9E9E9E | (não mapeável → cinza, com log) |
| AZUL PEROLIZADO | 1 | #9E9E9E | #2196F3 |
| CINZA PEROLIZADO | 1 | #9E9E9E | #9E9E9E (sem impacto visível) |

**Total: 1.197 veículos** no painel da Softruck estão com cor errada. Quase todos brancos (1.176). Bug existe desde a primeira versão do `mapVehicleColor` — passou despercebido porque cinza no painel não chama atenção.

Cores que já caem corretamente (masculino bate no dicionário atual): PRATA 976, PRETO 799, CINZA 540, VERMELHO 382, AZUL 168, AMARELO 37, BEGE 34, VERDE 29, MARROM 23, DOURADO 16, LARANJA 11, ROXO 1.

## Enum oficial Softruck (14 hex válidos)

Único conjunto aceito pela API; qualquer hex fora disso é rejeitado:

```
#FF9800  laranja
#FF5722  vermelho
#795548  marrom
#9E9E9E  cinza
#8BC34A  verde
#2196F3  azul
#FFC107  amarelo
#FFEB3B  amarelo (alternativo)
#FFFFFF  branco
#9C27B0  roxo
#C2185B  vinho/pink
#212121  preto
#F8BBD0  rosa
#E1C699  bege/champagne
```

Implicações importantes: **PRATA, DOURADO e AZUL MARINHO não têm hex próprio na Softruck.** Vão ser aproximados (prata → cinza, dourado → amarelo, azul marinho → azul). Decisão precisa ficar documentada em comentário no código pra não ser revertida por engano depois.

## Correção

### Arquivo único: `supabase/functions/softruck-api/index.ts`

**1. Reescrever `SOFTRUCK_COLORS` mapeando todas variantes para os 14 hex válidos**

Cobertura mínima (todas as variantes CRLV que aparecem hoje no banco + variantes prováveis):

- branco/branca/white/branca pero(lizada)/perola → `#FFFFFF`
- preto/preta/black/preta met(.)/preta metalica → `#212121`
- prata/silver/prateado/prateada → `#9E9E9E` *(sem hex próprio na Softruck — comentar)*
- cinza/gray/grey/cinza pero(lizado)/cinza claro/cinza escuro/grafite/chumbo → `#9E9E9E`
- vermelho/vermelha/red/vermelha pero(lizada)/bordo → `#FF5722`
- azul/blue/azul pero(lizado)/azul marinho/azul-marinho/azul escuro/azul-escuro/azul claro/azul-claro → `#2196F3` *(Softruck não distingue tons de azul — comentar)*
- amarelo/amarela/yellow → `#FFC107`
- dourado/dourada/gold → `#FFC107` *(sem hex próprio — vai como amarelo)*
- verde/green/verde escuro/verde claro/verde militar → `#8BC34A`
- marrom/brown/café/cafe → `#795548`
- bege/beige/champagne/champanhe → `#E1C699`
- laranja/orange → `#FF9800`
- roxo/purple/violeta/lilás/lilas → `#9C27B0`
- vinho/wine/bordeaux/bordô/bordo → `#C2185B`
- rosa/pink → `#F8BBD0`

Cabeçalho do arquivo com comentário fixo: "Os 14 hex aqui são o enum fechado da API Softruck. Não criar hex novo — escolher o mais próximo dentre esses 14."

**2. `mapVehicleColor` mais robusto + log estruturado obrigatório**

```ts
function mapVehicleColor(cor: string | null, ctx?: { action: string; placa?: string; chassi?: string }): string {
  if (!cor) return '#9E9E9E';
  if (/^#[0-9A-Fa-f]{6}$/.test(cor)) return cor.toUpperCase(); // já hex

  const normalized = cor.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');

  // 1) match completo
  if (SOFTRUCK_COLORS[normalized]) return SOFTRUCK_COLORS[normalized];

  // 2) match pela primeira palavra (cobre "azul perolizado", "preta met", etc.)
  const first = normalized.split(' ')[0];
  if (first && SOFTRUCK_COLORS[first]) {
    console.warn('[softruck-api][color-fallback-firstword]', JSON.stringify({
      original: cor, normalized, matched: first, hex: SOFTRUCK_COLORS[first], ctx,
    }));
    return SOFTRUCK_COLORS[first];
  }

  // 3) default cinza — ALERTA. Toda cor que cair aqui é cor nova não catalogada.
  console.error('[softruck-api][color-unmapped]', JSON.stringify({
    original: cor, normalized, default_hex: '#9E9E9E', ctx,
  }));
  return '#9E9E9E';
}
```

`console.error` (não warn) para a operação conseguir filtrar `level=error` no painel de logs e descobrir cor nova no mesmo dia. Esse log é a peça central — evita o próximo "MARROM ESCURO virou cinza silenciosamente". Caso exista canal de alerta operacional plugado em logs estruturados, é o sinal certo pra disparar.

**3. `atualizar-veiculo` passa a usar `mapVehicleColor` (linha 471)**

```ts
if (cor) attrs.color = mapVehicleColor(cor, { action: 'atualizar-veiculo', placa, chassi });
```

Mesmo padrão no `criar-veiculo` (linha 423): passar `ctx` para o log estruturado.

### Backfill — separado do deploy

Não embutir no PR do fix. Executar como passo posterior, depois que o dicionário corrigido estiver em produção e validado pelo KWT9J48:

1. Validação pontual: chamar `softruck-api` action `atualizar-veiculo` para o KWT9J48 mandando `cor: 'PRETA'`. Conferir no painel que ficou preto e que o log estruturado mostra `matched: preta → #212121`.
2. Listar os 1.197 veículos afetados:
   ```sql
   SELECT id, placa, cor, softruck_vehicle_id FROM veiculos
   WHERE softruck_vehicle_id IS NOT NULL
     AND UPPER(TRIM(cor)) IN ('BRANCA','PRETA','VERMELHA','BRANCA PEROLIZADA',
                              'AZUL PEROLIZADO','BRANCA PEROLIZADA','FANTASIA');
   ```
3. Rodar batch chamando `atualizar-veiculo` para cada um (com pausa pra não rate-limitar). Logar resultado por veículo. Operação pode acompanhar pelo `cor-unmapped` log estruturado se aparecer alguma surpresa fora da lista acima.
4. FANTASIA (2 veículos) ficam como cinza propositalmente e entram no log de `color-unmapped` — operação decide manualmente o que fazer.

## Fora de escopo

- Rede Veículos e SGA não são alterados — bug é exclusivo do adaptador Softruck.
- Cadastro continua aceitando cor no padrão CRLV (feminino). A correção é só na borda Softruck.
- Não criar UI nova de edição de cor — já existe.

## Aprovado e mantido

- Camada de correção é o adaptador Softruck, não o CRM
- `atualizar-veiculo` passa a usar `mapVehicleColor` (mesma regra do `criar-veiculo`)
- Normalização agressiva (espaços, hífens, acentos, primeira palavra como fallback)
- Não tocar em Rede Veículos / SGA
