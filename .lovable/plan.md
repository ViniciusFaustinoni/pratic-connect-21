

# Plano: Exibir Hora de Login e Localização na Equipe do Coordenador

## O que existe hoje

- **Tabela `turnos_profissionais`**: tem `inicio_turno` (timestamp de quando o profissional iniciou o turno/logou no dia). Existe por profissional por dia.
- **Tabela `vistoriadores_localizacao`**: tem `latitude`, `longitude`, `em_servico`, `updated_at` por profissional. Atualizada em tempo real pelo app mobile.
- **Hook `useEquipe.ts`**: já busca dados de `vistoriadores_localizacao` (linhas 98-112) mas **só usa `em_servico` e `updated_at`** — não busca `latitude`/`longitude`. **Não busca `turnos_profissionais`**.
- **`EquipeCard.tsx`**: exibe status operacional, tarefas do dia, rastreadores em posse e última atividade. **Não mostra hora de login nem localização**.

## Implementação

### 1. Hook `useEquipe.ts` — buscar dados adicionais

Adicionar duas consultas extras no `queryFn`:

**a) Turno do dia** — buscar `inicio_turno` de `turnos_profissionais` para cada profissional (data = hoje, status != 'encerrado' ou qualquer):
```
SELECT profissional_id, inicio_turno, status 
FROM turnos_profissionais 
WHERE profissional_id IN (...) AND data = hoje
```
Mapear para o campo `inicio_turno: string | null` na interface `ProfissionalEquipe`.

**b) Coordenadas** — já busca `vistoriadores_localizacao`, apenas adicionar `latitude, longitude` ao select existente (linha 102). Mapear para `latitude: number | null`, `longitude: number | null` na interface.

### 2. Interface `ProfissionalEquipe` — novos campos

Adicionar:
- `inicio_turno: string | null` — hora exata que logou/iniciou turno
- `latitude: number | null` — última latitude conhecida
- `longitude: number | null` — última longitude conhecida

### 3. `EquipeCard.tsx` — exibir informações

**Hora de login**: Novo item na seção de contato/info, com ícone de relógio:
- Se `inicio_turno` existe: "Logou às HH:mm"
- Se não: "Não logou hoje"

**Localização**: Novo item com ícone de mapa:
- Se tem coordenadas (mesmo offline): exibir link clicável "Ver no mapa" que abre Google Maps na posição
- Texto auxiliar: "Atualizado há X min" baseado no `updated_at` da localização
- Se não tem coordenadas: "Sem localização"

A localização persiste mesmo que o profissional fique offline, pois a tabela `vistoriadores_localizacao` mantém o último registro. O hook já busca dados dos últimos 60 minutos — vou remover esse filtro de cutoff para que a última posição conhecida sempre apareça, independente de quando foi.

### 4. Ajuste no filtro de localização

Atualmente o hook filtra `gte('updated_at', cutoffTime)` com cutoff de 60 minutos. Para garantir que a localização apareça mesmo que o profissional esteja offline há mais tempo, remover esse filtro. A informação de "há quanto tempo" será exibida no card para o coordenador avaliar a relevância.

## Arquivos afetados

- `src/hooks/useEquipe.ts` — buscar `inicio_turno` de turnos + `latitude`/`longitude` de localização, remover filtro de 60min
- `src/components/equipe/EquipeCard.tsx` — exibir hora de login e link de localização

## O que NÃO será alterado

- Nenhuma tela do app do instalador
- Nenhuma lógica de rotas ou tarefas

