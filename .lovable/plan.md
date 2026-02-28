

# Tela de Plantoes Mensal + Ponto por Geolocalizacao da Base

## Resumo

Substituir o painel simples "Escala do Dia" por uma tela completa de **Plantoes Mensais**, onde o coordenador visualiza um calendario mensal e atribui vistoriadores como "Rota" ou "Base" em cada dia. Alem disso, adicionar a tag "Base da Pratic" nas oficinas e usar a geolocalizacao da oficina marcada para validar o ponto de entrada do vistoriador em base.

## Alteracoes

### 1. Nova coluna `is_base_pratic` na tabela `oficinas`

Adicionar flag booleana para marcar oficinas como base operacional da Pratic. A geolocalizacao (latitude/longitude) ja existe na tabela.

```text
ALTER TABLE oficinas ADD COLUMN is_base_pratic boolean DEFAULT false;
```

### 2. Substituir EscalaDiaPanel por tela de Plantoes Mensal

**Remover**: `src/components/equipe/EscalaDiaPanel.tsx` (conteudo substituido)

**Novo componente**: `src/components/equipe/PlantoesCalendario.tsx`

Tela com:
- Seletor de mes/ano no topo
- Grade tipo calendario mostrando todos os dias do mes
- Cada dia mostra os vistoriadores alocados com badge Rota (azul) ou Base (amarelo)
- Clique em um dia abre modal para editar alocacoes daquele dia
- Botao "Copiar semana anterior" para facilitar o preenchimento
- Resumo lateral com total de dias alocados por profissional

### 3. Modal de edicao de dia

**Novo componente**: `src/components/equipe/PlantaoDiaModal.tsx`

Ao clicar em um dia do calendario:
- Lista todos os vistoriadores ativos
- Toggle Rota/Base para cada um (igual ao EscalaDiaPanel atual)
- Botao salvar (upsert em `alocacoes_diarias`)

A tabela `alocacoes_diarias` ja existente continua sendo usada — a unica mudanca e a interface que passa de diaria para mensal.

### 4. Integrar na pagina Equipe

**Arquivo**: `src/pages/monitoramento/Equipe.tsx`

Substituir `<EscalaDiaPanel />` pelo novo `<PlantoesCalendario />` com uma aba ou secao dedicada.

### 5. Tag "Base da Pratic" no cadastro de oficinas

**Arquivo**: `src/components/oficinas/OficinaForm.tsx` (ou equivalente)

Adicionar checkbox "Marcar como Base da Pratic" no formulario de cadastro/edicao de oficina. Quando marcado, salva `is_base_pratic = true`.

### 6. Ponto de entrada por geolocalizacao da base

**Arquivo**: `src/hooks/useIniciarServico.ts`

Na funcao `iniciarServico`, apos obter a geolocalizacao do vistoriador:

1. Consultar `useAlocacaoDiaria` para verificar se o profissional esta alocado como "base" hoje
2. Se sim:
   - Buscar oficinas com `is_base_pratic = true`
   - Calcular distancia entre a posicao do vistoriador e a oficina-base
   - Se distancia <= 200 metros: ponto validado, criar turno normalmente
   - Se distancia > 200 metros: exibir erro "Voce precisa estar na base para iniciar o turno"
3. Se rota: manter comportamento atual (GPS obrigatorio, sem validacao de local)

### 7. Hook auxiliar para buscar bases Pratic

**Novo arquivo**: `src/hooks/useBasesPratic.ts`

Hook simples que busca oficinas com `is_base_pratic = true` e retorna suas coordenadas. Usado pelo `useIniciarServico` para validar proximidade.

## Resumo de Arquivos

| Arquivo | Acao |
|---|---|
| Nova migration SQL | Adicionar `is_base_pratic` em `oficinas` |
| `src/components/equipe/EscalaDiaPanel.tsx` | Substituir por `PlantoesCalendario.tsx` |
| `src/components/equipe/PlantoesCalendario.tsx` | **NOVO** — Calendario mensal de plantoes |
| `src/components/equipe/PlantaoDiaModal.tsx` | **NOVO** — Modal de edicao de dia |
| `src/pages/monitoramento/Equipe.tsx` | Usar PlantoesCalendario no lugar de EscalaDiaPanel |
| `src/hooks/useBasesPratic.ts` | **NOVO** — Buscar oficinas marcadas como base |
| `src/hooks/useIniciarServico.ts` | Validar proximidade da base para vistoriadores em base |
| Formulario de oficina (cadastro/edicao) | Adicionar toggle "Base da Pratic" |

## Fluxo do Ponto para Vistoriador em Base

```text
Vistoriador abre o app e clica "Iniciar Turno"
  |
  v
Sistema obtem geolocalizacao do dispositivo
  |
  v
Consulta alocacao do dia → tipo = 'base'?
  |
  +-- NAO (rota) → fluxo normal (GPS + atribuir tarefa)
  |
  +-- SIM (base) → busca oficinas com is_base_pratic = true
                     |
                     v
                   Calcula distancia (Haversine)
                     |
                     +-- <= 200m → Ponto validado! Turno criado.
                     |
                     +-- > 200m → Erro: "Aproxime-se da base para registrar ponto"
```

## Fluxo do Calendario de Plantoes

```text
Coordenador abre Monitoramento > Equipe
  |
  v
Secao "Plantoes" mostra calendario do mes atual
  |
  v
Cada dia mostra badges dos vistoriadores alocados
  |
  v
Clica em um dia → Modal abre com lista de vistoriadores
  |
  v
Define Rota/Base para cada um → Salva
  |
  v
Dados salvos em alocacoes_diarias (historico automatico)
```

