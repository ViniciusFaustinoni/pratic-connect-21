

# Agendamento de Vistoria de Evento + Perfil Regulador

## Resumo

Criar 3 funcionalidades: (1) seção de agendamento de vistoria na página pública do associado após conclusão das 3 etapas, (2) novo perfil de acesso "regulador" no enum `app_role`, (3) área logada do regulador com dashboard e fila de vistorias.

---

## 1. Banco de Dados

### Nova tabela: `vistorias_evento`

Armazena os agendamentos de vistoria de evento (similar a `instalacoes` mas para sinistros):

- `id` (uuid, PK)
- `sinistro_id` (uuid, FK -> sinistros, NOT NULL)
- `link_id` (uuid, FK -> sinistro_evento_links)
- `regulador_id` (uuid, FK -> profiles) -- profissional atribuído
- `data_agendada` (date, NOT NULL)
- `horario_agendado` (time, NOT NULL)
- `endereco_rua` (text)
- `endereco_numero` (text)
- `endereco_bairro` (text)
- `endereco_cidade` (text)
- `endereco_complemento` (text)
- `status` (text, default 'agendada') -- 'agendada', 'em_andamento', 'concluida', 'cancelada'
- `dados_vistoria` (jsonb) -- fotos, vídeo, orçamento (preenchido pelo regulador)
- `iniciada_em` (timestamptz)
- `concluida_em` (timestamptz)
- `observacoes` (text)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

RLS: anon pode INSERT (via edge function), authenticated com role regulador/diretor/gerencia pode SELECT/UPDATE.

### Alteração no enum `app_role`

Adicionar valor `regulador` ao enum existente.

### Alteração na tabela `sinistro_evento_links`

Adicionar campo `etapa4_completada_em` (timestamptz) para registrar quando o agendamento foi feito.

---

## 2. Edge Function: `agendar-vistoria-evento`

Nova edge function pública (verify_jwt = false) que recebe:

- `token` -- token do link do evento
- `data_agendada` -- data selecionada
- `horario_agendado` -- horário selecionado (ex: "09:30")
- `endereco` -- objeto com rua, numero, bairro, cidade, complemento

Lógica:
1. Valida o token (link ativo + não expirado + etapa_atual >= 3)
2. Verifica se o horário está disponível (não conflita com outro agendamento)
3. Cria registro em `vistorias_evento` com status 'agendada'
4. Atualiza `sinistro_evento_links.etapa4_completada_em`
5. Retorna confirmação com dados do agendamento

### Endpoint de horários disponíveis

A mesma edge function (ou uma separada `horarios-vistoria-evento`) retorna os horários disponíveis para uma data:
- Slots de 30 em 30 minutos, das 08:00 às 17:00
- Exclui horários já ocupados (busca em `vistorias_evento` com status != 'cancelada')

---

## 3. Perfil Regulador

### Atualização do enum no banco
```text
ALTER TYPE public.app_role ADD VALUE 'regulador';
```

### Atualização no frontend (`src/types/auth.ts`)
- Adicionar `'regulador'` ao type `PerfilAcesso`
- Adicionar `regulador: 'Regulador'` no `PERFIL_ACESSO_LABELS`
- Adicionar flag `isRegulador` no `AuthFlags`

### Atualização em `usePermissions.ts`
- Adicionar `isRegulador` e `isReguladorOnly`
- Regulador "only" redireciona para `/regulador` (similar ao instalador)

### Atualização em `useRouteGuard.ts`
- Adicionar regra: regulador só pode acessar `/regulador/*`

---

## 4. Área Logada do Regulador

### Layout: `ReguladorLayout.tsx`
Baseado no `InstaladorLayout.tsx`, com navegação inferior:
- Início (`/regulador`)
- Vistorias (`/regulador/vistorias`)
- Perfil (`/regulador/perfil`)

### Guard: `ReguladorGuard.tsx`
Similar ao `InstaladorGuard.tsx`, verifica `hasRole('regulador')`.

### Dashboard: `ReguladorHome.tsx`
- 3 cards de métricas: Vistorias Hoje, Esta Semana, Total Pendentes
- Lista resumida das próximas vistorias do dia

### Lista de Vistorias: `ReguladorVistorias.tsx`
- Cards com dados: nome associado, placa, marca/modelo/ano/cor, tipo evento, data/hora, endereço, status
- Filtros: data (hoje/amanhã/semana/todas) e status (agendadas/em_andamento/concluídas)
- Ordenação por data/hora (mais próximas primeiro)
- Botão "Iniciar Vistoria" em cada card (placeholder -- será implementado no próximo prompt)

### Hook: `useVistoriasEvento.ts`
- Busca vistorias do regulador logado
- Filtros por data e status
- Contadores para dashboard

### Rotas no `App.tsx`
```text
/regulador/login -> InstaladorLogin (reutiliza)
/regulador       -> ReguladorHome
/regulador/vistorias -> ReguladorVistorias
/regulador/perfil -> ReguladorPerfil (reutiliza InstaladorPerfil adaptado)
```

---

## 5. Página Pública: Seção de Agendamento (Etapa 4)

### Modificação em `EventoColisao.tsx`
Após `isCompleted` (etapa_atual >= 3), ao invés de mostrar apenas `EventoSucesso`, verificar:
- Se `etapa4_completada_em` existe: mostrar `EventoSucesso` com dados do agendamento
- Se não: mostrar `EventoAgendamento` + `EventoSucesso` parcial

### Novo componente: `EventoAgendamento.tsx`
- Título "Agende sua Vistoria de Evento"
- Explicação sobre o regulador
- Calendário (próximos 15 dias úteis) usando DayPicker
- Grid de horários disponíveis (08:00-17:00, 30 em 30 min)
- Campos de endereço: Rua, Número, Bairro, Cidade, Complemento/Referência
- Botão "Confirmar Agendamento"
- Ao confirmar: chama `agendar-vistoria-evento`, mostra mensagem de sucesso

---

## 6. Arquivos a Criar

| Arquivo | Descrição |
|---|---|
| Migration SQL | Tabela `vistorias_evento`, enum `regulador`, campo `etapa4_completada_em` |
| `supabase/functions/agendar-vistoria-evento/index.ts` | Cria agendamento + retorna horários disponíveis |
| `src/pages/regulador/ReguladorHome.tsx` | Dashboard do regulador |
| `src/pages/regulador/ReguladorVistorias.tsx` | Lista/fila de vistorias |
| `src/components/regulador/ReguladorLayout.tsx` | Layout com nav inferior |
| `src/components/regulador/ReguladorGuard.tsx` | Guard de acesso |
| `src/components/evento/EventoAgendamento.tsx` | Seção de agendamento na página pública |
| `src/hooks/useVistoriasEvento.ts` | Hook para buscar vistorias do regulador |

## 7. Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `src/types/auth.ts` | Adicionar 'regulador' ao PerfilAcesso + labels + flags |
| `src/hooks/usePermissions.ts` | Adicionar isRegulador, isReguladorOnly |
| `src/hooks/useRouteGuard.ts` | Regra de redirect para regulador |
| `src/pages/public/EventoColisao.tsx` | Integrar seção de agendamento após etapa 3 |
| `src/components/evento/EventoSucesso.tsx` | Mostrar dados do agendamento quando existirem |
| `src/App.tsx` | Rotas `/regulador/*` |
| `supabase/config.toml` | verify_jwt = false para `agendar-vistoria-evento` |
| `supabase/functions/validar-link-evento/index.ts` | Retornar dados de agendamento se existir |

---

## 8. Lógica de Horários Disponíveis

```text
Slots fixos: 08:00, 08:30, 09:00, ..., 16:30, 17:00 (19 slots)

Para uma data selecionada:
1. Buscar vistorias_evento WHERE data_agendada = data AND status != 'cancelada'
2. Extrair horarios ocupados
3. Retornar slots - ocupados = disponíveis
```

A capacidade por horário é 1 (um regulador por vez por slot). Se houver mais reguladores no futuro, pode-se expandir.

