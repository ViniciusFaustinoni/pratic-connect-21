

# Painel do Analista de Eventos

## Resumo

Criar o perfil "analista_eventos" no enum `app_role`, sua area logada com dashboard e fila de eventos, e a tela de analise completa com todas as informacoes do evento para tomada de decisao (aprovar ou reprovar). A aprovacao gera um novo link para o associado e invalida o anterior.

---

## 1. Banco de Dados

### Adicionar valor ao enum `app_role`

```text
ALTER TYPE public.app_role ADD VALUE 'analista_eventos';
```

### Adicionar status ao sinistro (se necessario)

Verificar se `reprovado` existe no enum de status. Caso contrario, adicionar. O status `aprovado` ja existe (usado pela edge function `aprovar-sinistro`).

---

## 2. Perfil "analista_eventos" no Frontend

### `src/types/auth.ts`
- Adicionar `'analista_eventos'` ao type `PerfilAcesso`
- Adicionar `analista_eventos: 'Analista de Eventos'` no `PERFIL_ACESSO_LABELS`
- Adicionar flag `isAnalistaEventos` no `AuthFlags`

### `src/hooks/usePermissions.ts`
- Adicionar `isAnalistaEventos` e `isAnalistaEventosOnly`
- `isAnalistaEventosOnly` redireciona para `/analista-eventos`
- Incluir em `isPerfilLimitado`

### `src/hooks/useRouteGuard.ts`
- Adicionar regra: analista_eventos so pode acessar `/analista-eventos/*`

---

## 3. Area Logada do Analista de Eventos

### Layout: `AnalistaEventosLayout.tsx`
Baseado no `ReguladorLayout.tsx`, com header e navegacao inferior:
- Inicio (`/analista-eventos`)
- Eventos (`/analista-eventos/fila`)
- Perfil (`/analista-eventos/perfil`)

### Guard: `AnalistaEventosGuard.tsx`
Similar ao `ReguladorGuard.tsx`, verifica `hasRole('analista_eventos')`.

### Dashboard: `AnalistaEventosHome.tsx`
- 4 cards de metricas:
  - Aguardando analise (sinistros com status `aguardando_analise`)
  - Analisados hoje (aprovados + reprovados hoje)
  - Aprovados este mes
  - Reprovados este mes

### Fila de Eventos: `AnalistaEventosFila.tsx`
- Lista de cards de sinistros com status `aguardando_analise`
- Cada card: nome associado, placa, tipo evento, data evento, nome do regulador
- Ordenacao: mais antigo primeiro (FIFO)
- Click abre a tela de analise detalhada

---

## 4. Tela de Analise do Evento (`/analista-eventos/evento/:sinistroId`)

### Hook: `useEventoAnaliseDetalhe.ts`
Busca completa de dados para a analise:
- Sinistro com associado, veiculo, plano
- Link do evento (dados das 3 etapas: fotos, B.O., relato, audio)
- Vistoria do regulador (dados_vistoria com fotos, video, orcamento, parecer)
- Fotos da vistoria de adesao (via `vistoria_fotos` -> `vistorias` -> `contratos` -> `veiculos`)
- Contadores: tempo como associado, eventos anteriores
- Status de adimplencia

### Componente principal: `EventoAnaliseDetalhe.tsx`
Pagina com secoes colapsaveis (Accordion):

**Secao 1 -- Dados do Associado:**
- Nome, CPF, telefone, email
- Plano, categoria
- Adimplencia
- Tempo como associado (calculado desde `created_at` do associado)
- Quantidade de eventos anteriores (count de sinistros do mesmo associado)

**Secao 2 -- Dados do Veiculo:**
- Placa, Marca, Modelo, Ano, Cor
- Valor FIPE, Chassi
- Rastreador (buscar em `instalacoes` se tem rastreador ativo)

**Secao 3 -- Cronologia do Evento:**
- Data/hora do evento
- Data/hora da comunicacao
- Tempo entre evento e comunicacao (calculo detalhado com dias, horas, minutos)
- Alerta vermelho se > 30 dias
- Data/hora do envio da documentacao (etapa3_completada_em do link)
- Data/hora da vistoria do regulador (concluida_em da vistoria_evento)

**Secao 4 -- Relato do Associado:**
- Relato escrito (dados_etapa3.relato_texto)
- Audio gravado (dados_etapa3.audio_url) com player
- Local informado (dados_etapa3)
- Dados do terceiro (dados_etapa3)

**Secao 5 -- Boletim de Ocorrencia:**
- Documento (dados_etapa2.bo_url) com visualizador
- Numero do B.O.
- Resumo do B.O.

**Secao 6 -- Fotos da Auto Vistoria (Etapa 1):**
- Grid de fotos (dados_etapa1.fotos_urls)
- Clicavel com zoom (VisualizadorFoto)

**Secao 7 -- Vistoria do Regulador:**
- 10 fotos em grid (dados_vistoria.fotos_urls)
- Video (dados_vistoria.video_url)
- Diagnostico: tipo de dano
- Descricao tecnica
- Tabela de orcamento com itens
- Valor total
- Parecer tecnico
- Recomendacao

**Secao 8 -- Fotos da Vistoria de Adesao:**
- Fotos originais da vistoria de quando o associado entrou (via `vistoria_fotos` -> `vistorias` -> `contratos`)
- Reutiliza logica de `useFotosVistoriaPorVeiculo` existente
- Grid com zoom para comparacao

### Barra de Acoes (fixa no rodape)
- Botao "Reprovar Evento" (vermelho)
- Botao "Aprovar Evento" (verde)

---

## 5. Modal de Reprovacao

Ao clicar "Reprovar Evento":
- Modal com:
  - Seletor de motivo padrao: "Documentacao insuficiente", "Prazo expirado", "Irregularidade detectada", "Fraude suspeita", "Outro"
  - Textarea obrigatorio para motivo detalhado
- Ao confirmar:
  - Atualiza `sinistros.status` para `reprovado`
  - Registra historico em `sinistro_historico`
  - Invalida o link do evento
  - Envia WhatsApp ao associado com motivo

---

## 6. Modal de Aprovacao

Ao clicar "Aprovar Evento":
- Modal com:
  - Resumo: associado, veiculo, valor FIPE, valor orcamento
  - Campo "Observacoes do analista" (opcional)
  - Checkbox obrigatorio: "Confirmo que analisei toda a documentacao..."
- Ao confirmar:
  - Atualiza `sinistros.status` para `aprovado`
  - Registra historico
  - Invalida link anterior
  - Gera novo link (reutiliza edge function `gerar-link-evento`)
  - Envia WhatsApp com aprovacao e novo link
  - Cria Termo de Entrada via Autentique (reutiliza `aprovar-sinistro` ou invoca `autentique-evento-create`)

---

## 7. Edge Function: `analisar-evento`

Nova edge function autenticada que centraliza as acoes do analista:

**Recebe:**
- `sinistro_id`
- `acao`: "aprovar" | "reprovar"
- `observacao` (para aprovacao)
- `motivo` e `motivo_padrao` (para reprovacao)

**Logica de aprovacao:**
1. Atualiza status para `aprovado`
2. Registra historico
3. Invalida links ativos existentes
4. Gera novo link (72h) em `sinistro_evento_links`
5. Invoca `autentique-evento-create` para gerar termo
6. Envia WhatsApp ao associado

**Logica de reprovacao:**
1. Atualiza status para `reprovado`
2. Registra historico com motivo
3. Invalida links ativos
4. Envia WhatsApp ao associado com motivo

---

## 8. Rotas no App.tsx

```text
/analista-eventos          -> AnalistaEventosHome
/analista-eventos/fila     -> AnalistaEventosFila
/analista-eventos/evento/:id -> EventoAnaliseDetalhe
/analista-eventos/perfil   -> InstaladorPerfil (reutiliza)
```

---

## 9. Arquivos a Criar

| Arquivo | Descricao |
|---|---|
| Migration SQL | Enum `analista_eventos`, status `reprovado` |
| `supabase/functions/analisar-evento/index.ts` | Aprovar/reprovar com historico, link e WhatsApp |
| `src/components/analista-eventos/AnalistaEventosLayout.tsx` | Layout com nav inferior |
| `src/components/analista-eventos/AnalistaEventosGuard.tsx` | Guard de acesso |
| `src/pages/analista-eventos/AnalistaEventosHome.tsx` | Dashboard com contadores |
| `src/pages/analista-eventos/AnalistaEventosFila.tsx` | Lista/fila de eventos |
| `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx` | Tela completa de analise |
| `src/hooks/useEventoAnaliseDetalhe.ts` | Hook para dados completos do evento |
| `src/hooks/useEventosAnalise.ts` | Hook para lista e contadores |

## 10. Arquivos a Modificar

| Arquivo | Mudanca |
|---|---|
| `src/types/auth.ts` | Adicionar `analista_eventos` ao PerfilAcesso, labels e flags |
| `src/hooks/usePermissions.ts` | Adicionar `isAnalistaEventos`, `isAnalistaEventosOnly` |
| `src/hooks/useRouteGuard.ts` | Regra de redirect para analista_eventos |
| `src/App.tsx` | Rotas `/analista-eventos/*` |
| `supabase/config.toml` | Nao precisa (edge function autenticada) |

---

## 11. Cronologia -- Calculo Detalhado

```text
Para o campo "Tempo entre evento e comunicacao":

diffMs = created_at(sinistro) - data_ocorrencia(sinistro)

dias = floor(diffMs / 86400000)
horas = floor((diffMs % 86400000) / 3600000)
minutos = floor((diffMs % 3600000) / 60000)

Exibir: "X dias, Y horas e Z minutos"

Se dias >= 30: badge vermelho "PRAZO EXPIRADO - Comunicado apos 30 dias"
Se dias >= 7: badge amarelo "Atenao - Comunicado apos 7 dias"
```

---

## 12. Fotos da Vistoria de Adesao

Reutilizar a logica do hook `useFotosVistoriaPorVeiculo` existente que percorre:
`veiculos -> contratos -> vistorias -> vistoria_fotos`

Isso retorna todas as fotos da vistoria de adesao original, permitindo ao analista comparar com as fotos do evento atual.

