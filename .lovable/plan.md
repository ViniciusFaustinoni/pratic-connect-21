## Reorganização do roteiro de vistoria completa (v2) — carro + moto

Aplica-se a: vistoria do técnico (carro e moto) **e** autovistoria completa sub-FIPE (cliente faz pelo celular).
**Não toca** em `autovistoriaConfig.ts` (enxuta acima FIPE — 2 fotos + vídeo 360°).

---

### 1. Confirmações de escopo

- **Carro:** `chassi` e `motor` já são fotos separadas no config atual. v2 só muda `categoria` e `ordem` — sem alias, sem renomear ids.
- **Moto:** `motor_chassi` (id único hoje) é desmembrado em `chassi`, `motor_direito`, `motor_esquerdo`. Alias de leitura `motor_chassi` fica **apenas no LEGACY** para histórico de vistorias antigas não quebrar.
- Avarias da moto: continua `opcional: true`.

---

### 2. Pré-requisito: eliminar leitura "cega" antes do flag

Antes de materializar v2/LEGACY, **toda leitura precisa passar `criadoEm`**. Senão a vistoria antiga renderiza v2 silenciosamente.

#### 2.1 Refactor de assinaturas (`src/data/vistoriaConfigCompleta.ts`)

Adicionar `criadoEm?: string` em:
- `getFotosByTipoVeiculo`
- `getCategoriasByTipoVeiculo`
- `agruparFotosPorCategoriaCompleta`
- `getFotosFiltradas`
- `getCategoriasFiltradas`
- `agruparFotosFiltradas`
- `getFotosApenasInstalacao`
- `agruparFotosApenasInstalacao`
- `getTotalFotosObrigatorias`

Adicionar `criadoEm?: string` em `src/data/vistoriaSubFipeAdapter.ts → getFotosVistoriaSubFipe` (propaga para baixo).

Helper interno: `usarRoteiroV2(criadoEm?: string): boolean` — se `criadoEm` ausente OU `criadoEm >= VISTORIA_ROTEIRO_V2_AT` → v2; senão LEGACY.

#### 2.2 Refactor de 2 consumers críticos

- **`src/hooks/useGerarLaudoVistoria.ts`** — trocar imports dos constants top-level por `getFotosByTipoVeiculo(tipo, vistoria.created_at)` e `getCategoriasByTipoVeiculo(tipo, vistoria.created_at)`.
- **`src/pages/CotacaoPublicaCompleta.tsx`** — trocar import direto de `FOTOS_VISTORIA_COMPLETA_CLIENTE` por `getFotosVistoriaSubFipe(tipo, cotacao.created_at)`.

#### 2.3 Passar `criadoEm` nos 3 consumers já preparados

- `VistoriaPublica.tsx` (5 chamadas) — usa `vistoria.created_at`
- `InstaladorChecklist.tsx` (3 chamadas) — usa `vistoria.created_at`
- `ExecutarVistoriaCompleta.tsx` (5 chamadas) — usa `vistoria.created_at`

#### 2.4 Remover exports dos constants top-level

Após 2.1–2.3, tornar `FOTOS_VISTORIA_COMPLETA`, `FOTOS_VISTORIA_MOTO`, `CATEGORIAS_VISTORIA_COMPLETA`, `CATEGORIAS_VISTORIA_MOTO`, `TOTAL_FOTOS_OBRIGATORIAS`, `IDS_FOTOS_OBRIGATORIAS` **não-exportados** (privados do módulo). TypeScript vira rede de segurança contra reincidência.

Consumers válidos que precisam de constant top-level continuam usando as funções com `criadoEm`.

---

### 3. Materialização v2 + LEGACY

Em `vistoriaConfigCompleta.ts`:

```ts
export const VISTORIA_ROTEIRO_V2_AT = '<timestamp do deploy>'; // ISO UTC
```

#### 3.1 Carro — 31 fotos reordenadas (sem novos ids)

Snapshot atual → `FOTOS_VISTORIA_COMPLETA_LEGACY` (congelado).
Novo array `FOTOS_VISTORIA_COMPLETA_V2` reordenado:

| ordem | id | categoria |
|---|---|---|
| 1 | vistoriador_selfie | identificacao |
| 2 | chave | identificacao |
| 3 | chassi | identificacao |
| 4 | capo_aberto_placa | motor_compartimento |
| 5 | motor | motor_compartimento |
| 6 | bateria | motor_compartimento |
| 7–21 | frente, farol_dir, lateral_dir, … (volta externa) | volta_externa |
| 20–22 | porta_malas_*, estepe | porta_malas |
| 23–29 | bancos / forrações | bancos_forracoes |
| 30 | painel_ligado | operacionais |
| 31 | odometro | operacionais |

(ordem final detalhada via diff conservador sobre o array atual — ids preservados, apenas `categoria` e `ordem` mudam).

Categorias v2: `identificacao`, `motor_compartimento`, `volta_externa`, `porta_malas`, `bancos_forracoes`, `operacionais`, `instalacao`.

#### 3.2 Moto — 15 fotos (10 existentes + 5 novas, desmembrando motor_chassi)

`FOTOS_VISTORIA_MOTO_LEGACY` = snapshot atual (12 fotos incluindo `motor_chassi`).

`FOTOS_VISTORIA_MOTO_V2` — 15 fotos:

| ordem | id | obrigatória | categoria |
|---|---|---|---|
| 1 | vistoriador_selfie | sim | identificacao |
| 2 | chave | não | identificacao |
| 3 | chassi | sim | identificacao |
| 4 | frente | sim | volta_externa |
| 5 | farol | sim | volta_externa |
| 6 | lateral_direita | sim | volta_externa |
| 7 | sola_pneu_dianteiro | não | volta_externa |
| 8 | motor_direito | sim | volta_externa |
| 9 | traseira | sim | volta_externa |
| 10 | sola_pneu_traseiro | não | volta_externa |
| 11 | lateral_esquerda | sim | volta_externa |
| 12 | motor_esquerdo | sim | volta_externa |
| 13 | banco | não | operacionais |
| 14 | bateria_validade | não | operacionais |
| 15 | painel_odometro_ligado | sim | operacionais |

Avarias permanece `opcional: true` (não entra na contagem das 15).

**Alias de leitura** (só LEGACY): no `agruparFotos*` em modo LEGACY, manter `motor_chassi` reconhecido para vistorias antigas — sem regravar nada.

#### 3.3 Roteamento

```ts
const FOTOS_CARRO = (criadoEm) => usarRoteiroV2(criadoEm) ? V2 : LEGACY;
```

`getFotosByTipoVeiculo(tipo, criadoEm)` → escolhe v2/LEGACY por tipo.

---

### 4. Geração do .docx

Arquivo: `/mnt/documents/roteiro-vistoria-carro-moto-v2.docx`.

Conteúdo:
- Título + data de vigência (VISTORIA_ROTEIRO_V2_AT)
- Roteiro CARRO (3 blocos, 31 itens numerados)
- Roteiro MOTO (3 blocos, 15 itens, com obrigatórias/opcionais)
- Nota: "Autovistoria enxuta acima-FIPE permanece inalterada (2 fotos + vídeo 360°)"

QA visual: converte cada página a JPEG e inspeciona antes de entregar.

---

### 5. QA pós-implementação

- `/vistoria/completa?vistoria=<antiga>` → renderiza LEGACY (motor_chassi visível)
- `/vistoria/completa?vistoria=<nova>` → renderiza v2 (chassi + motores separados)
- `/cotacao/<x>/autovistoria` (enxuta acima FIPE) → intocado
- Sub-FIPE completa cliente (`CotacaoPublicaCompleta`) → v2 nova / LEGACY antiga
- `useGerarLaudoVistoria` em vistoria antiga → laudo com layout LEGACY
- `tsc` passa (constants top-level removidos confirmam que nada lê cego)

---

### 6. Memória

- Atualizar `mem://index.md` com 1 linha apontando o leaf.
- Criar `mem://logic/operations/roteiro-vistoria-v2`: regra do flag por data, escopo (técnico + autovistoria completa sub-FIPE), exclusão da enxuta, alias `motor_chassi` só em LEGACY.

---

### Fora de escopo

- `autovistoriaConfig.ts` (enxuta)
- Edges (`finalizar-autovistoria-cotacao`, `aprovar-proposta`, etc.) — leem fotos por id, não por ordem
- `VistoriaFotoSequencial`, `Autovistoria` (sub-FIPE)
- Migration de dados históricos (não há — flag por data resolve)
