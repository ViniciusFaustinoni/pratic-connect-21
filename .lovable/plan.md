

## Problema

Na "Lista de Instalações" e no popup do mapa, a placa da Kelly Cristina aparece como `0KM321B3` — o **placeholder técnico** que o sistema gera para veículos 0km (vide `src/lib/placa-utils.ts`). Esse valor nunca deve ser exibido ao usuário; deveria ser substituído por **"0KM (sem placa)"** via `formatPlacaExibicao()`.

O popup do mapa (segunda imagem) já está exibindo corretamente "0KM (sem placa)" no título com o badge "0KM" amarelo. O problema está na **Lista de Instalações** (primeira imagem) que renderiza o valor cru do banco.

## Investigação necessária

1. Localizar o componente "Lista de Instalações" (provavelmente em `/monitoramento/mapa` aba Instalações ou em página dedicada).
2. Confirmar se está renderizando `instalacao.placa` direto sem passar por `formatPlacaExibicao()`.
3. Buscar outros lugares que ainda exibem placa crua (tabelas de vistorias, agendamentos, etc.).

## Plano

### 1) Aplicar `formatPlacaExibicao()` na Lista de Instalações

Trocar `{placa}` por `{formatPlacaExibicao(placa)}` no componente da lista. Isso fará o `0KM321B3` virar `0KM (sem placa)` automaticamente.

### 2) Adicionar badge "0KM" visual (opcional, alinhar com popup)

Para consistência visual com o popup do mapa, exibir o badge amarelo "0KM" ao lado do texto quando `isPlacaPlaceholder(placa)` for true.

### 3) Varredura por outros pontos cegos

Buscar no código (`grep` por `\.placa` em componentes de exibição) onde a placa é renderizada sem passar pelo helper. Lugares prováveis:
- Tabelas de agendamentos
- Cards de vistoria
- Históricos de associado
- Tooltips/labels de pinos no mapa (se houver)

Aplicar `formatPlacaExibicao()` em todos.

### 4) Sem mudança de banco

O placeholder no banco é correto e necessário (constraint NOT NULL/UNIQUE). Mudança é puramente de **camada de apresentação**.

## Resultado

Lista de Instalações passa a mostrar **"0KM (sem placa)"** com badge "0KM" amarelo (igual ao popup do mapa). Demais telas que ainda exibem placa crua de 0km também são corrigidas.

