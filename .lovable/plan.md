## Objetivo

Substituir o conjunto de fotos da autovistoria (hoje 2 fotos + vídeo 360°) por um novo conjunto fixo de **9 fotos** com OCR de placa em tempo real, garantindo que a placa lida nas fotos seja a mesma do veículo cadastrado.

## Novo conjunto de fotos (carros e motos)

| # | id | label | OCR placa? |
|---|---|---|---|
| 1 | `frente_centro` | Frente — placa centralizada | sim |
| 2 | `frente_lateral_esquerda` | Frente em diagonal — lateral esquerda + placa | sim |
| 3 | `frente_lateral_direita` | Frente em diagonal — lateral direita + placa | sim |
| 4 | `traseira_centro` | Traseira — placa centralizada | sim |
| 5 | `traseira_lateral_esquerda` | Traseira em diagonal — lateral esquerda + placa | sim |
| 6 | `traseira_lateral_direita` | Traseira em diagonal — lateral direita + placa | sim |
| 7 | `chassi` | Número do chassi | não (já existe `chassi-ocr` validando contra CRLV) |
| 8 | `motor` | Compartimento do motor | não |
| 9 | `painel_ligado` | Painel com o veículo ligado (luzes do quadro acesas) | não |

Para motos os labels e instruções são adaptados ("frente da moto", "lateral da moto", "tubo do garfo", "painel ligado mostrando hodômetro"). O conjunto e os ids são os mesmos para reaproveitar o pipeline.

## Vídeo 360°

Removido como obrigatório (substituído pelas 9 fotos). Conforme o que o usuário pediu — mas posso mantê-lo como opcional se preferir; a regra padrão será remover.

## OCR da placa

Nova edge function `placa-ocr` (espelhada em `chassi-ocr`):
- Input: `{ url, placaEsperada, cotacaoId?, vistoriaId?, fotoTipo }`.
- Modelo: `google/gemini-2.5-flash` via `aiGatewayFetch`.
- System prompt instrui a extrair texto da placa brasileira (formato `AAA-9999` ou Mercosul `AAA9A99`), normalizar (uppercase, sem hífen) e devolver `{ placa, confianca, legivel, observacao }`.
- Comparação server-side: `placaEsperada` normalizada × `placa` lida.
  - `match = true` se iguais.
  - Tolerância opcional: 1 caractere de divergência com `confianca >= 0.6` → retorna `match=false, suspeita=true` (não bloqueia mas alerta).
- Retorno: `{ placa, match, confianca, observacao }`.

### Quando rodar

No hook `useUploadFotoCotacaoVistoria` (e equivalente em `Autovistoria.tsx`/`useFotosAutovistoria`), após o upload de qualquer foto cujo `id` esteja no set "OCR placa? sim" (1–6):
- Buscar a placa esperada da cotação/contrato (`cotacoes.placa` ou `veiculos.placa`).
- Chamar `placa-ocr`.
- Se `match`: avança normalmente.
- Se `legivel=false`: toast de aviso "Placa não legível, refaça a foto" e **não** consome o slot.
- Se `match=false` mas `legivel=true`: bloqueia avanço, exibe toast "A placa lida (`XYZ1A23`) não bate com a do veículo (`ABC1D23`). Refaça a foto." e mantém slot vazio.
- Persistir o resultado em `cotacoes_vistoria_fotos.metadados` (jsonb) — `{ placa_lida, match, confianca }` — para auditoria.

Veículos `0KM` (placa começando com `0KM` ou `aguardando_placa_definitiva=true`) **pulam** o OCR de placa (apenas validação de presença da foto), porque ainda não há placa real. Aplicar a mesma exceção que o restante do sistema usa.

## Arquivos afetados

### Configuração e tipos
- `src/data/autovistoriaConfig.ts` — substituir `FOTOS_AUTOVISTORIA_CARRO`/`FOTOS_AUTOVISTORIA_MOTO` pelas 9 fotos descritas, com `categoria` (`exterior_frente`, `exterior_traseira`, `identificacao`, `interior`); remover `INSTRUCOES_VIDEO_360_*`/`getInstrucoesVideo360`/`getLabelVideo360` (ou marcar `@deprecated` e parar de usar).

### Telas
- `src/components/cotacao-publica/AutovistoriaCotacao.tsx` — remover bloco de vídeo 360°, ajustar `progresso` e estado `videoUrl`/`videoConfirmado`/`uploadingVideo`, remover hidratação de `video_360`. Mostrar resultado do OCR de placa (badge "Placa OK"/"Placa divergente") no card da foto.
- `src/components/associado/Autovistoria.tsx` — mesmas mudanças.
- `src/components/cadastro/VistoriaFotosCard.tsx` e `src/hooks/useFotosAutovistoria.ts` — atualizar `TIPOS_EXTERIOR`/`formatarTipoFoto` para reconhecer os 6 novos ids (`frente_centro`, `frente_lateral_esquerda`, `frente_lateral_direita`, `traseira_centro`, `traseira_lateral_esquerda`, `traseira_lateral_direita`, `painel_ligado`) e renderizar agrupado.

### Hook de upload
- `src/hooks/useCotacaoVistoria.ts` — após upload das fotos da lista de placa, invocar `placa-ocr`; estender `UploadFotoResult` com `placaOcr?: { placa, match, confianca, legivel }`. Bloquear avanço quando `match=false`.

### Edge function nova
- `supabase/functions/placa-ocr/index.ts` — clone enxuto de `chassi-ocr`, com comparação contra `placaEsperada`. Sem `verify_jwt` (chamado pelo fluxo público da cotação) e com CORS padrão.

### Migration
- Adicionar coluna `metadados jsonb default '{}'::jsonb` em `cotacoes_vistoria_fotos` e em `vistoria_fotos` se ainda não existir, para guardar `{ placa_lida, match, confianca }`. (Verificar antes via select; se já existir, pular.)

## Validação

1. Cotação com placa `ABC1D23`: subir foto da frente correta → toast verde "Placa confirmada (ABC1D23)".
2. Mesma cotação: subir foto de outro veículo → bloqueio "Placa lida XYZ1A23 ≠ esperada ABC1D23".
3. Foto borrada → "Placa não legível, refaça".
4. Veículo 0KM → OCR de placa pulado, fluxo prossegue.
5. Concluir as 9 fotos → finalizar autovistoria sem exigência de vídeo.
6. Recarregar a página no meio do fluxo → reidratação correta dos 9 slots.

## Não muda

- Status pós-vistoria, fila de Monitoramento, ativação de cobertura R/F (continua sendo após Monitoramento aprovar).
- Validação de chassi via `chassi-ocr` contra CRLV.
- Fluxo de agendamento de vistoria/instalação presencial.
