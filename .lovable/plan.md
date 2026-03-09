

# Análise: Sistema de Rastreamento, Rota e Velocidade em Colisões

## 1. Sincronização Periódica de Posições dos Veículos

**Status: Configurado mas SEM rastreadores ativos**

O cron `sync-rastreadores` executa periodicamente e os logs confirmam que está rodando:
```
[sync-rastreadores] Nenhum rastreador para sincronizar
```

O sistema busca rastreadores com `status = 'instalado'` e IDs de plataforma válidos (Softruck ou Rede Veículos). Atualmente retorna 0 rastreadores, o que significa que nenhum rastreador no banco está com `status = 'instalado'` E com `plataforma_device_id`/`plataforma_veiculo_id` preenchidos.

Quando houver rastreadores configurados, o cron:
- Busca posição atual de cada rastreador via API da plataforma
- Insere na tabela `rastreadores_posicoes` (com velocidade, ignição, odômetro, etc.)
- Limpa posições com mais de 7 dias

## 2. Rota dos Veículos

**Status: Salva parcialmente**

- As **posições pontuais** são salvas na tabela `rastreadores_posicoes` pelo cron (quando há rastreadores ativos)
- O **histórico de trajeto** NÃO é salvo continuamente -- ele é buscado sob demanda via API da Softruck pela edge function `rastreador-historico` quando o analista abre a tela de detalhes do sinistro
- O trajeto pode ser **salvo como snapshot** no sinistro via `SalvarTrajetoButton` (campo `snapshot_trajeto_json`)

## 3. Detalhes de Colisão para o Analista

**Status: Rota OK, Velocidade Média NÃO exibida**

O `TrajetoColisaoCard` exibe:
- Mapa com trajeto de 4h antes da colisão (via OSRM para rota real pelas ruas)
- Marcadores de paradas e local da colisão
- Badges com total de pontos e paradas
- Fonte dos dados (API ou Local)

**GAP identificado**: A edge function `rastreador-historico` retorna os dados de `velocidade` em cada ponto do trajeto, porém o `TrajetoColisaoCard` **NÃO calcula nem exibe**:
- Velocidade média
- Velocidade máxima
- Distância total percorrida
- Tempo em movimento vs parado

A edge function `historico-posicoes` tem a função `calcularResumo()` que faz esses cálculos, mas o `rastreador-historico` (usado pelo card de colisão) NÃO retorna um campo `resumo`.

---

## Plano de Correção

### Tarefa 1: Adicionar resumo de velocidade e distância ao TrajetoColisaoCard

No componente `TrajetoColisaoCard.tsx`, calcular no frontend (os dados de velocidade já vêm em cada ponto):
- Velocidade média (média dos pontos com velocidade > 0)
- Velocidade máxima
- Distância total (Haversine entre pontos consecutivos)
- Exibir esses dados como badges/cards abaixo do mapa

**Arquivo**: `src/components/sinistros/TrajetoColisaoCard.tsx` (linhas 264-277, seção de badges)

### Tarefa 2: (Informativo) Rastreadores sem dados

O cron está funcional mas sem rastreadores para sincronizar. Isto é uma questão de dados -- os rastreadores precisam ter `status = 'instalado'` e IDs de plataforma configurados. Não requer mudança de código.

