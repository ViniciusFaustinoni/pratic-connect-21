

# Exibir bairro do vistoriador (localização atual) na Atribuição Manual

## Problema
Os cards de vistoriadores na aba "Atribuição Manual" mostram apenas nome e tarefas, sem indicar onde o vistoriador está fisicamente.

## Solução
Fazer reverse geocoding das coordenadas de cada vistoriador para obter o bairro atual e exibi-lo no card.

### 1. `src/hooks/useAtribuicaoManual.ts` — `useVistoriadoresAtivos`
- Após obter lat/lng de `vistoriadores_localizacao`, fazer reverse geocoding via Nominatim (OpenStreetMap) para cada vistoriador
- Usar `Promise.allSettled` com rate-limiting (batch) para evitar sobrecarregar a API
- Cachear o resultado no retorno do hook (campo `bairroAtual`)
- Alternativa mais simples e robusta: chamar a edge function `reverse-geocode` já existente no projeto para cada vistoriador

### 2. `src/components/monitoramento/AtribuicaoManualTab.tsx` — `DroppableVistoriador`
- Adicionar linha com ícone `MapPin` e o `bairroAtual` abaixo do nome do vistoriador
- Exibir "Localizando..." enquanto o geocoding carrega
- Mostrar a hora da última atualização de localização (campo `ultimaAtualizacao`)

### Dados exibidos no card do vistoriador (atualizado)
```text
┌──────────────────────────────────┐
│ [Avatar]  João Silva   Disponível│
│           📍 Centro, São Paulo   │
│           Atualizado há 3 min    │
│           2 tarefa(s) atribuída  │
│ ┌──────────────────────────────┐ │
│ │ 🔧 Instalação · Jardins     │ │
│ │ 📋 Vistoria · Vila Mariana  │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

### Abordagem técnica
- Usar Nominatim diretamente no client (`fetch` para `https://nominatim.openstreetmap.org/reverse?lat=X&lon=Y&format=json`)
- Extrair `address.suburb` ou `address.neighbourhood` como bairro, e `address.city` como cidade
- Limitar a 1 request por segundo (Nominatim policy) usando delay sequencial
- O `refetchInterval: 30000` já existente no hook garante atualização periódica

## Impacto
- 2 arquivos alterados (hook + componente)
- 0 migrations, 0 dependências novas

