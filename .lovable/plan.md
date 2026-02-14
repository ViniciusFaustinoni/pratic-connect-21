
# Logica Completa de Sindicancias

## Resumo do Estado Atual

### O que ja existe:
- `EncaminharSindicanciaDialog`: modal basico que atribui sindicante + motivo (texto livre) + prazo de 30 dias. Atualiza status para `em_sindicancia`, grava historico.
- Colunas no banco: `sindicante_id`, `sindicancia_prazo_fim`, `resultado_sindicancia` (text), `perito_id`, `resultado_pericia` (text)
- Tipo `ResultadoSindicancia` em `types/sinistros.ts`: apenas `regular | irregular | inconclusivo`
- Status `em_sindicancia` no workflow com transicoes definidas
- Dashboard conta sindicancias no grafico de taxa de aprovacao

### O que falta:
1. O `EncaminharSindicanciaDialog` **nao esta conectado** ao `SinistroDetalhe` (nao existe botao nem import)
2. Nao existe modal de **concluir sindicancia** (registrar resultado)
3. Nao existe **card visual** no detalhe do sinistro mostrando status da sindicancia ativa
4. O tipo `ResultadoSindicancia` esta incompleto (faltam `carta_cancelamento` e `juridico`)
5. Nao existe logica de **suspensao do prazo de 60 dias** visivel no sistema
6. Falta dropdown de motivos predefinidos no encaminhamento
7. Alertas do dashboard nao verificam sindicancias vencendo

---

## Alteracoes Planejadas

### 1. Atualizar tipo ResultadoSindicancia

**Arquivo:** `src/types/sinistros.ts`

Expandir de 3 para 5 resultados possiveis:
- `regular` — sem fraude, evento volta para aprovado
- `irregular` — fraude comprovada, evento negado + cria caso juridico
- `carta_cancelamento` — associado desiste, notifica juridico
- `juridico` — caso complexo, encaminha para juridico
- `inconclusivo` — vai para diretoria decidir

### 2. Melhorar EncaminharSindicanciaDialog

**Arquivo:** `src/components/sinistros/EncaminharSindicanciaDialog.tsx`

Adicionar:
- Dropdown de motivos predefinidos por tipo de evento:
  - Colisao: "Relato inconsistente", "Fotos nao conferem com B.O.", "Historico de multiplos sinistros", "Tempo suspeito", "Condutor embriagado", "CNH vencida"
  - Roubo/Furto: "Dados do rastreador suspeitos", "Locais suspeitos", "Mudanca de rotina", "Rastreador nao instalado"
  - Incendio: "Suspeita de incendio provocado", "GNV irregular", "Sobrecarga eletrica"
  - Alagamento: "Entrada deliberada em area alagada", "Agua salgada", "Local inadequado"
- Campo de observacao complementar (textarea)
- Opcao de marcar como pericia tecnica (checkbox) — mesmo fluxo, motivo diferente

### 3. Criar ConcluirSindicanciaModal

**Novo arquivo:** `src/components/sinistros/ConcluirSindicanciaModal.tsx`

Modal com:
- RadioGroup com 5 opcoes de resultado (regular, irregular, carta_cancelamento, juridico, inconclusivo)
- Textarea obrigatoria para relatorio final (min 200 caracteres)
- Secao de anexar evidencias (upload de arquivos para storage)
- Para cada resultado, acoes automaticas:
  - **Regular**: atualiza status para `aprovado`, retoma prazo de 60 dias
  - **Irregular**: atualiza status para `negado`, cria registro em `processos` com tipo "sindicancia_fraude", motivo_negacao = "fraude_suspeita"
  - **Carta cancelamento**: atualiza status para `cancelado`, notifica juridico
  - **Juridico**: atualiza status para `suspenso`, cria registro em `processos`
  - **Inconclusivo**: atualiza status para `suspenso`, marca para diretoria
- Grava resultado em `resultado_sindicancia`
- Registra no historico com observacao detalhada

### 4. Criar CardSindicanciaStatus

**Novo arquivo:** `src/components/sinistros/CardSindicanciaStatus.tsx`

Card para a sidebar do SinistroDetalhe, visivel quando `status === 'em_sindicancia'`:
- Badge "Em Sindicancia" com cor rose
- Nome do sindicante responsavel (query pelo sindicante_id -> profiles)
- Contagem regressiva: "X dias restantes de 30" com barra de progresso
- Alerta vermelho se prazo < 7 dias
- Alerta critico se prazo vencido
- Informacao: "Prazo de ressarcimento SUSPENSO durante a sindicancia"
- Botao "Concluir Sindicancia" que abre o ConcluirSindicanciaModal (visivel para analista/diretor)
- Se ja concluida (`resultado_sindicancia` preenchido): mostra resultado + data

### 5. Integrar no SinistroDetalhe

**Arquivo:** `src/pages/eventos/SinistroDetalhe.tsx`

- Importar `EncaminharSindicanciaDialog` e `CardSindicanciaStatus`
- Adicionar state `modalSindicanciaOpen`
- No dropdown de acoes: adicionar item "Encaminhar para Sindicancia" (visivel quando status permite: `em_analise`, `aguardando_parecer`, `em_vistoria`)
- Na sidebar: renderizar `CardSindicanciaStatus` quando `status === 'em_sindicancia'`
- Passar `sindicante_id` na query do sinistro (ja esta: `sindicante:profiles!sinistros_sindicante_id_fkey`)

Obs: a query principal do sinistro ja faz select de `*` mas nao inclui o join do sindicante. Adicionar:
```
sindicante:profiles!sinistros_sindicante_id_fkey(id, nome)
```

### 6. Suspensao do Prazo de Ressarcimento

Logica visual no SinistroDetalhe:
- Quando `status === 'em_sindicancia'`, exibir alerta na secao de valores/prazos: "Prazo de 60 dias uteis SUSPENSO — sindicancia ativa desde DD/MM"
- Quando sindicancia concluida com resultado `regular`, o historico mostrara "Prazo retomado"

### 7. Alertas no Dashboard

**Arquivo:** `src/hooks/useEventosDashboard.ts`

Na funcao `useAlertasUrgentes`, adicionar:
- Alerta amarelo: "X sindicancias com prazo vencendo nos proximos 7 dias"
  - Query: `status = 'em_sindicancia' AND sindicancia_prazo_fim BETWEEN NOW() AND NOW() + 7d`
- Alerta vermelho: "X sindicancias com prazo vencido"
  - Query: `status = 'em_sindicancia' AND sindicancia_prazo_fim < NOW()`

---

## Resumo de Arquivos

| Acao | Arquivo |
|---|---|
| Modificar | `src/types/sinistros.ts` (expandir ResultadoSindicancia) |
| Modificar | `src/components/sinistros/EncaminharSindicanciaDialog.tsx` (dropdown motivos) |
| Criar | `src/components/sinistros/ConcluirSindicanciaModal.tsx` (5 resultados) |
| Criar | `src/components/sinistros/CardSindicanciaStatus.tsx` (card sidebar) |
| Modificar | `src/pages/eventos/SinistroDetalhe.tsx` (integrar sindicancia) |
| Modificar | `src/hooks/useEventosDashboard.ts` (alertas sindicancia) |

## Migracao de Banco

Nenhuma migracao necessaria. As colunas `resultado_sindicancia` (text), `sindicancia_prazo_fim`, `sindicante_id` e `perito_id` ja existem na tabela `sinistros`. O campo `resultado_sindicancia` e text livre, nao enum, entao aceita os novos valores sem alteracao de schema.

## Ordem de Implementacao

1. `types/sinistros.ts` — expandir tipo
2. `EncaminharSindicanciaDialog.tsx` — melhorar com motivos predefinidos
3. `ConcluirSindicanciaModal.tsx` — criar modal de conclusao
4. `CardSindicanciaStatus.tsx` — criar card de status
5. `SinistroDetalhe.tsx` — integrar tudo
6. `useEventosDashboard.ts` — alertas de prazo
