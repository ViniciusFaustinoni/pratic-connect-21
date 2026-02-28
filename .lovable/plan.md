

# Ajustar Fotos de Autovistoria e Instalacao para Moto

## Contexto

Existem 3 arquivos de configuracao de fotos que tratam motos de formas diferentes. O usuario definiu exatamente quais fotos devem ser exigidas em cada etapa do processo de ativacao de moto.

## Alteracoes

### 1. Autovistoria Moto (`src/data/autovistoriaConfig.ts`)

Reduzir de 10 para 7 fotos, conforme especificacao:

| # | Foto | Status Atual |
|---|------|-------------|
| 1 | Frente | Ja existe |
| 2 | Traseira | Ja existe |
| 3 | Lateral Direita | Ja existe |
| 4 | Lateral Esquerda | Ja existe |
| 5 | Painel com KM visivel | Ja existe (odometro) |
| 6 | Motor / Chassi visivel | Unificar chassi + motor em 1 foto |
| 7 | Avarias (se houver) | **NOVO** - foto opcional para registro de avarias |

**Remover**: selfie_veiculo, pneu_dianteiro, pneu_traseiro (nao constam na especificacao de moto)

### 2. Instalacao Moto (`src/data/vistoriaConfigCompleta.ts`)

Ajustar `FOTOS_VISTORIA_MOTO` para conter as mesmas 7 fotos da autovistoria (refeitas) + fotos tecnicas do rastreador:

**Fotos do veiculo (refazer todas da autovistoria):**
1. Frente
2. Traseira
3. Lateral Direita
4. Lateral Esquerda
5. Painel com KM atual
6. Motor / Chassi
7. Avarias novas (se houver)

**Fotos tecnicas do rastreador (ja existem parcialmente):**
8. Local exato da instalacao (ja existe)
9. Codigo do rastreador visivel (**NOVO**)
10. Teste de comunicacao / online (**NOVO**)

### 3. Checklist do Instalador (`src/data/vistoriaConfig.ts`)

Ajustar `FOTOS_MOTO` para alinhar com a mesma estrutura da instalacao, removendo fotos que nao constam na especificacao (vistoriador, farol, chave, banco, pneus).

## Arquivos Alterados

| Arquivo | O que muda |
|---|---|
| `src/data/autovistoriaConfig.ts` | Reduzir FOTOS_AUTOVISTORIA_MOTO de 10 para 7 fotos |
| `src/data/vistoriaConfigCompleta.ts` | Ajustar FOTOS_VISTORIA_MOTO para 7 fotos veiculo + 3 tecnicas |
| `src/data/vistoriaConfig.ts` | Alinhar FOTOS_MOTO com a especificacao |

