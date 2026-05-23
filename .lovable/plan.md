## O que aconteceu

Você tem razão — a detecção de tipo de veículo já tinha sido refatorada, mas **só em frontend/edges**. A RPC do banco `fn_veiculo_precisa_rastreador` (usada por `aprovar-proposta`, triggers e pelo guard `trg_guard_dispensa_rastreador_coerente`) ficou de fora e mantém uma **terceira heurística paralela**:

1. **Canônico (memória "Vehicle detection" + "Catálogo marcas_modelos divergente"):** `marcas_modelos.tipo_veiculo` é a fonte oficial; quando o catálogo diz "carro" para Honda/Yamaha/BMW, roda override por `MOTO_BRANDS` + keyword de modelo. Usado em `finalizar-autovistoria-cotacao`, `escopoAnaliseCadastro.ts` etc.
2. **RPC do banco (descasada):** consulta `configuracoes.marcas_exclusivas_moto` (CSV que **propositalmente exclui** Honda/Yamaha por serem ambíguas) + regex hard-coded de modelo. Foi onde o `ELITE 125` caiu — o regex usava `\m...\m` (início+início de palavra em Postgres) em vez de `\y...\y`, então qualquer modelo terminando em número (ELITE 125, ADV 150, NH 125, SH 150) não casava e o veículo era tratado como carro.
3. **Verificação local em `aprovar-proposta`:** o próprio comentário do código diz que migraram pra RPC justamente por causa de "Honda ADV 150 que marcas_modelos classificava como carro" — ou seja, o motivo de existir a RPC era contornar o catálogo, e a RPC virou a fonte sem nunca consultar o catálogo.

A confirmação está em `marcas_modelos`: **HONDA / ELITE 125 já está cadastrado como `tipo_veiculo='moto'`**. Se a RPC tivesse consultado o catálogo primeiro, o bug nem teria existido.

O fix do regex (`\m`→`\y`) que rodou agora resolve o sintoma, mas não fecha o gap arquitetural: continuam três fontes paralelas se contradizendo.

---

## Plano

### 1. Refatorar `fn_veiculo_precisa_rastreador` para usar a fonte canônica

Migration única reescrevendo a função com esta ordem de decisão (mesma lógica do override em `finalizar-autovistoria-cotacao`):

```text
1. Diesel → sempre exige rastreador (regra absoluta).
2. Consultar marcas_modelos.tipo_veiculo por (marca, modelo) do veículo.
   - Match exato (upper+trim) → se 'moto', é moto.
3. Override quando catálogo ausente OU diz 'carro':
   a. marca ∈ marcas_exclusivas_moto (config) → moto.
   b. modelo casa regex de keywords de moto (mantido como rede,
      com \y nas duas bordas — não \m).
4. Aplicar FIPE mínimo:
   - moto: configuracoes.operacional_fipe_minimo_rastreador_moto (9000)
   - carro: configuracoes.operacional_fipe_minimo_rastreador (30000)
5. FIPE ausente/zero → fail-safe: exige rastreador.
```

Vantagem: quando o operador cadastra uma moto nova em `marcas_modelos` como `tipo_veiculo='moto'`, a RPC respeita automaticamente, sem depender de regex hard-coded ou de o CSV de marcas exclusivas ser atualizado.

### 2. Backfill auditável

Rodar query de auditoria (somente SELECT, sem mutação) que liste, na base atual:

- Veículos onde a NOVA função discordaria da função antiga.
- Quantos têm `dispensa_rastreador=true` em `instalacoes` indevidamente.
- Quantos têm `veiculos.status='ativo'` sem rastreador para Diesel/moto FIPE≥9k/carro FIPE≥30k.

Não corrige em massa — devolve o relatório pra você decidir caso a caso (regra `mem://debt/data/lote-import-abril-2026-orfaos`: nunca migração em massa cega).

### 3. Atualizar memórias canônicas

- `mem://logic/operations/vehicle-type-detection-source`: incluir que **a RPC do banco também segue o mesmo override** (antes só citava frontend/edges).
- `mem://logic/operations/catalogo-marcas-modelos-divergente`: adicionar que `fn_veiculo_precisa_rastreador` aplica o mesmo override.
- Atualizar índice se necessário.

### 4. C1 (do plano anterior) opcional aqui

Como a refatoração resolve o problema raiz (consultar catálogo), o C1 que eu tinha proposto (logging especial pra marcas ambíguas) vira menos crítico — mas se você quiser, dá pra adicionar um `RAISE NOTICE` na RPC quando o catálogo está ausente E o override decide o tipo, pra ficar rastreável em logs do Postgres.

---

## Por que isso não foi feito junto da refatoração original

A refatoração canônica do tipo de veículo nasceu no contexto de **autovistoria** (`finalizar-autovistoria-cotacao` precisava decidir entre 31 fotos carro / 15 fotos moto). A RPC `fn_veiculo_precisa_rastreador` foi criada/mantida em paralelo para servir a outro propósito (FIPE mínimo), e ninguém percebeu que ela tinha sua própria heurística de moto/carro descasada. O bug do ELITE 125 expôs essa duplicidade.

---

## Risco

Baixo. A função é STABLE, a mudança preserva os mesmos retornos (true/false), e o override é igual ao já usado em produção pelo `finalizar-autovistoria-cotacao`. O guard `trg_guard_dispensa_rastreador_coerente` continua válido — só passa a bloquear corretamente casos que antes vazavam.

---

**Confirma 1+2+3? E C1 entra junto ou backlog?**