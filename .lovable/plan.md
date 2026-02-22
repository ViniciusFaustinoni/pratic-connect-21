
# S04 — Portal Completo do Sindicante

## Resumo

Reescrever completamente o dashboard e a pagina de detalhe do sindicante, transformando-os de placeholders basicos em um portal completo com: cards KPI corretos, alertas de prazo, cards de caso ricos, filtros por tabs, pagina de detalhe em 2 colunas com dados do evento (somente leitura), mapa de comparacao GPS, galeria de fotos/video, diligencias com upload de evidencias, solicitacoes, timeline, barra de prazo, e botao "Iniciar Investigacao". Tambem configurar o menu lateral para mostrar apenas Dashboard e Meus Casos quando o usuario for sindicante.

---

## 1. Configurar menu lateral para sindicante

**Arquivo:** `src/components/layout/AppSidebar.tsx`

Na funcao `getVisibleGroups()` (linha ~519), adicionar condicao para `isSindicanteOnly`:

```
if (permissions.isSindicanteOnly) {
  return []; // Nenhum grupo de menu — sindicante so ve itens main
}
```

Na secao `visibleMainItems`, quando `isSindicanteOnly`, substituir por apenas 2 itens:
- Dashboard -> `/sindicante` (icone LayoutDashboard)
- Meus Casos -> `/sindicante` (icone Search)

Ambos apontam para a mesma rota pois o dashboard ja lista os casos. Alternativamente, criar rota `/sindicante/casos` separada se preferirmos.

---

## 2. Reescrever Dashboard do Sindicante

**Arquivo:** `src/pages/sindicante/SindicanteDashboard.tsx` (reescrever)

### Cabecalho
- Titulo: "Meus Casos de Sindicancia"
- Subtitulo: "Bem-vindo, [nome_fantasia da empresa vinculada ao profile]"
- Buscar empresa do sindicante: `empresas_sindicancia WHERE profile_id = profile.id`

### 4 Cards KPI
- **Novos**: count sindicancias status = 'atribuido'. Badge azul. Se > 0, animacao pulse.
- **Em Andamento**: count status = 'em_andamento'. Badge amarelo.
- **Prazo Urgente**: count status IN ('atribuido','em_andamento') AND data_limite <= hoje+5dias. Badge vermelho.
- **Concluidos no Mes**: count status IN ('laudo_emitido','encerrado') AND data_laudo ou updated_at >= primeiro dia do mes. Badge verde.

### Alerta de prazo (condicional)
- Se existem casos com data_limite <= hoje+3dias E status ativo: card vermelho de alerta
- Se data_limite < hoje: alerta critico "PRAZO VENCIDO"

### Filtros (Tabs)
- "Todos" | "Novos" (atribuido) | "Em Andamento" | "Concluidos" (laudo_emitido + encerrado)

### Lista de Casos como Cards
Cards horizontais ricos com:
- Numero da sindicancia + badge de status colorido
- Evento (protocolo) + tipo
- Veiculo (marca, modelo, ano, placa) — join via sinistros -> veiculos
- Associado (nome, CPF) — join via sinistros -> associados
- Data de abertura, prazo (dias restantes), diligencias realizadas (count), motivos (badges)
- Botao "Abrir Caso"
- Borda vermelha se prazo < 5 dias
- Badge pulsante "PRAZO VENCIDO" se prazo ja venceu

**Query:** sindicancias com joins:
```
sindicancias.select('*, sinistros(protocolo, tipo, data_ocorrencia, associado:associados(nome, cpf), veiculo:veiculos(marca, modelo, ano_modelo, placa))')
```
Tambem buscar contagem de diligencias por sindicancia (query separada ou subquery).

Ordenacao: status='atribuido' primeiro, depois por data_limite ASC.

---

## 3. Reescrever Detalhe do Caso

**Arquivo:** `src/pages/sindicante/SindicanteCasoDetalhe.tsx` (reescrever)

### Cabecalho
- Breadcrumb: Meus Casos > SIND-XXXXXXXX-001
- Titulo + badge status
- Subtitulo: "Evento #[protocolo] — [tipo]"
- Barra de prazo visual colorida (verde >10 dias, amarelo 5-10, vermelho <5)

### Layout 2 colunas (lg:grid-cols-3)

**Coluna esquerda (col-span-2):**

#### Card "Dados do Evento" (somente leitura)
- Tipo, data/hora, local, descricao
- Veiculo: marca, modelo, ano, placa, cor, valor FIPE
- Associado: nome, CPF, telefone
- Query via join sindicancias -> sinistros -> veiculos, sinistros -> associados

#### Card "Motivo da Sindicancia" (somente leitura)
- Motivos padronizados como badges (usando MOTIVOS_PADRONIZADOS labels)
- Descricao detalhada (campo `motivo`)

#### Card "Evidencias do Evento" (somente leitura)
- **Fotos da auto vistoria**: usar `sinistro_fotos` com `buscarFotosComUrls()` do service existente. Galeria de thumbnails clicaveis que abrem em tamanho maior (Dialog).
- **Video do associado**: buscar `sinistro_evento_links` -> campo `dados_etapas` para URL de video, ou `sinistro_documentos` tipo 'video'. Player HTML5.
- **B.O.**: buscar `sinistro_documentos` tipo 'boletim_ocorrencia'. Link download.
- **Fotos da vistoria do regulador**: buscar `vistorias_evento` -> `dados_vistoria` (campo JSONB com fotos). Galeria separada.
- **Parecer do regulador**: texto de `vistorias_evento.observacoes` ou campo do JSON.
- Cada item mostra "Nao disponivel" se nao existir.

#### Card "Mapa — Comparacao de Posicoes" (somente leitura)
- Reutilizar componente `ComparacaoPosicoes` existente
- Props: `latitudeInformada`, `longitudeInformada` (do sinistro), `rastreadorLat`, `rastreadorLng` (do sinistro: `rastreador_lat_momento`, `rastreador_lng_momento`)
- Badge de distancia com cores (ja implementado no componente)

#### Card "Minhas Diligencias"
- Lista cronologica de diligencias (ja existe parcialmente)
- Cada diligencia mostra tipo (badge), data, descricao, resultado, local
- **Novo**: mostrar evidencias anexadas — buscar `sindicancia_evidencias WHERE diligencia_id = X`, exibir thumbnails
- Botao "+ Registrar Diligencia"

#### Card "Solicitacoes de Informacao"
- Lista com tipo, descricao, status (badge colorida), resposta, data
- Botao "+ Nova Solicitacao"

**Coluna direita (col-span-1):**

#### Card "Acoes"
Botoes empilhados:
1. **"Iniciar Investigacao"** — visivel apenas se status='atribuido'. Ao clicar, UPDATE status='em_andamento'. Destaque especial.
2. **"Registrar Diligencia"** — botao principal azul. Desabilitado se status='atribuido'.
3. **"Solicitar Informacao"** — botao outline.
4. **"Emitir Laudo"** — botao vermelho. Habilitado apenas se status='em_andamento' E pelo menos 1 diligencia. Tooltip se desabilitado.

#### Card "Timeline"
- Combinar dados de:
  - `sindicancia.created_at` -> "Sindicancia aberta"
  - `sindicancia.data_atribuicao` -> "Caso atribuido"
  - Diligencias -> "Diligencia: [tipo]"
  - Solicitacoes -> "Solicitacao enviada" / "Solicitacao respondida"
  - `sindicancia.data_laudo` -> "Laudo emitido"
- Formato: data/hora + icone + descricao curta
- Ordem cronologica

#### Card "Informacoes do Prazo"
- Data abertura, data limite, dias corridos, dias restantes (com cor)
- Barra de progresso: (dias corridos / total dias) * 100%
- Cores: verde, amarelo, vermelho

---

## 4. Atualizar Modal de Diligencia

**Arquivo:** `src/components/sindicante/RegistrarDiligenciaModal.tsx` (atualizar)

Adicionar:
- Validacao minimo 30 caracteres na descricao
- Campo de upload multiplo (ate 10 arquivos, max 5MB cada, jpg/png/pdf)
- Upload para bucket `sindicancia-evidencias` na pasta `{sindicanciaId}/{diligenciaId}/`
- Apos inserir diligencia, inserir registros em `sindicancia_evidencias` com `diligencia_id`
- Usar `react-dropzone` (ja instalado) para area de upload

---

## 5. RLS — Garantir acesso do sindicante

Verificar se as politicas RLS permitem ao sindicante ler:
- `sinistros` (via sindicancias vinculadas)
- `sinistro_fotos` (via sinistro_id de sindicancias vinculadas)
- `sinistro_documentos` (idem)
- `vistorias_evento` (idem)
- `sinistro_evento_links` (idem)
- `veiculos` (via sinistros)
- `associados` (via sinistros)

Se nao existirem politicas para o perfil sindicante nessas tabelas, criar migracoes SQL para adicionar politicas de SELECT que permitam acesso apenas quando o sinistro_id pertence a uma sindicancia atribuida ao sindicante logado.

---

## Arquivos a Criar

Nenhum arquivo novo — todos ja existem.

## Arquivos a Modificar

| Arquivo | Alteracao |
|---|---|
| `src/components/layout/AppSidebar.tsx` | Adicionar menu sindicante-only (Dashboard + Meus Casos) |
| `src/pages/sindicante/SindicanteDashboard.tsx` | Reescrever completamente: KPIs corretos, alertas, cards ricos, filtros tabs |
| `src/pages/sindicante/SindicanteCasoDetalhe.tsx` | Reescrever completamente: 2 colunas, dados evento, evidencias, mapa, timeline, acoes |
| `src/components/sindicante/RegistrarDiligenciaModal.tsx` | Adicionar upload de evidencias e validacao 30 chars |

## Migracoes SQL (se necessario)

Politicas RLS de SELECT nas tabelas `sinistros`, `sinistro_fotos`, `sinistro_documentos`, `vistorias_evento`, `sinistro_evento_links`, `veiculos`, `associados` para o perfil sindicante — acesso restrito aos sinistros vinculados a sindicancias atribuidas ao sindicante logado.

## Sequencia de Implementacao

1. Verificar/criar politicas RLS para acesso do sindicante
2. Atualizar `AppSidebar.tsx` com menu sindicante
3. Reescrever `SindicanteDashboard.tsx`
4. Reescrever `SindicanteCasoDetalhe.tsx`
5. Atualizar `RegistrarDiligenciaModal.tsx` com upload de evidencias
