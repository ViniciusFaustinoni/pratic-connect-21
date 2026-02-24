

# Fotos do Reboquista -- Registro e Exibicao no Fluxo de Sinistros

## Resumo

Criar um sistema para armazenar fotos tiradas pelo reboquista durante a remocao do veiculo, exibindo-as tanto no chamado de assistencia quanto na tela de analise do evento (sinistro). O analista de eventos faz o upload manualmente. O sindicante tambem tera acesso somente-leitura.

---

## Estrutura de Dados

### Nova tabela: `fotos_reboquista`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| chamado_id | uuid FK -> chamados_assistencia | Chamado vinculado |
| arquivo_url | text NOT NULL | URL publica da foto |
| momento | text | 'chegada', 'carregamento', 'entrega', 'outro' |
| observacao | text | Anotacao opcional do analista |
| uploaded_by | uuid FK -> auth.users | Quem fez upload |
| created_at | timestamptz | Data/hora do upload |

### Storage bucket: `fotos-reboquista` (publico)

### RLS Policies:
- SELECT: perfis `analista_eventos`, `diretor`, `sindicante` (sindicante so via sinistro vinculado)
- INSERT: perfis `analista_eventos`, `diretor`
- DELETE: quem fez upload (uploaded_by = auth.uid()) OU diretor

---

## Parte 1: Backend -- Migracao e Hook

### 1.1 Migracao SQL
- Criar tabela `fotos_reboquista` com colunas acima
- Criar bucket `fotos-reboquista` (publico)
- Criar politicas RLS para SELECT/INSERT/DELETE
- Criar politicas de storage para upload e leitura

### 1.2 Hook React: `useFotosReboquista.ts`
- `useFotosReboquista(chamadoId)` -- busca fotos do chamado com join em `profiles` para nome de quem fez upload
- `useAddFotoReboquista()` -- upload de arquivo + insert na tabela
- `useDeleteFotoReboquista()` -- remove do storage + deleta registro
- `useFotosReboquistaBySinistro(sinistroId)` -- busca fotos via sinistro -> chamado_assistencia_id/chamado_origem_id

---

## Parte 2: Tela de Detalhes do Chamado de Assistencia

### Arquivo: `src/pages/assistencia/ChamadoDetalhe.tsx`

Adicionar um novo Card na coluna principal (apos o card de Prestador):

**Para chamados com tipo `reboque` ou similar:**
- Card destacado com titulo "Fotos do Reboquista" e badge com contagem
- Botao "+ Adicionar Fotos" abre modal de upload multiplo
- Grid de thumbnails 3 colunas (desktop) / 2 colunas (mobile)
- Clique na foto abre lightbox (VisualizadorFoto existente)
- Cada foto mostra data/hora e nome de quem fez upload
- Botao de excluir (visivel para quem fez upload ou diretor)
- Mensagem placeholder quando nao ha fotos

**Para chamados sem reboque:**
- Botao discreto "Adicionar fotos" caso queira registrar algo

### Novo componente: `FotosReboquistaUploadModal.tsx`
- Upload multiplo (ate 20 fotos, max 5MB cada, jpg/png)
- Select para "Momento da foto": Na chegada / Durante carregamento / Na entrega / Outro
- Campo de observacao (texto curto, opcional)
- Preview das fotos selecionadas antes de enviar

### Novo componente: `FotosReboquistaGallery.tsx`
- Componente reutilizavel que renderiza a galeria de fotos
- Aceita prop `readonly` para uso no sindicante
- Agrupa fotos por "momento" quando disponivel
- Integra com VisualizadorFoto para lightbox

---

## Parte 3: Tela de Analise do Evento (SinistroAnalise.tsx)

### Posicionamento
Inserir o novo card **entre** o card "Fotos da Auto-Vistoria" (linha ~1037) e o card "Fotos da Vistoria de Instalacao/Adesao" (linha ~1039).

### Card com visual diferenciado
- Borda azul / fundo azul claro para diferenciar
- Titulo: "Fotos do Reboquista" com badge azul "Via Assistencia 24h"
- Subtitulo: numero do chamado, data, tipo de servico
- Info do reboque: destino, data/hora do acionamento
- Galeria agrupada por momento (chegada / carregamento / entrega)
- Observacoes exibidas abaixo de cada thumbnail

### Logica de exibicao
- Busca `chamado_assistencia_id` ou `chamado_origem_id` do sinistro
- Se nao existir chamado vinculado: card nao aparece
- Se existir chamado mas sem fotos: card com aviso e botao para adicionar
- Se existir chamado com fotos: galeria completa

### Badge no cabecalho do sinistro
- Se houver chamado de assistencia vinculado, exibir badge clicavel "Assistencia: #PROTOCOLO -- status"

---

## Parte 4: Portal do Sindicante

### Arquivo: `src/pages/sindicante/SindicanteCasoDetalhe.tsx`

- Reutilizar `FotosReboquistaGallery` com `readonly={true}`
- Exibir o card somente se o sinistro tiver chamado vinculado com fotos
- Mesmo visual azul diferenciado

---

## Parte 5: Vinculacao Chamado <-> Evento

O vinculo ja existe na base (`sinistros.chamado_assistencia_id` e `chamados_assistencia.sinistro_id`). Melhorias:

### No chamado de assistencia (ChamadoDetalhe)
- Quando tipo for reboque, mostrar campo "Evento vinculado" com busca por protocolo
- Se o chamado ja tiver `sinistro_id`, exibir link para o evento
- Se o sinistro ja referenciar o chamado via `chamado_assistencia_id`, mostrar vinculo

### No evento (SinistroAnalise)
- Na secao de informacoes, se houver chamado vinculado, badge clicavel "Assistencia: #PROTOCOLO"

---

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| Nova migracao SQL | Tabela `fotos_reboquista`, bucket, RLS |
| `src/hooks/useFotosReboquista.ts` | Novo hook CRUD |
| `src/components/assistencia/FotosReboquistaGallery.tsx` | Novo componente galeria |
| `src/components/assistencia/FotosReboquistaUploadModal.tsx` | Novo modal de upload |
| `src/pages/assistencia/ChamadoDetalhe.tsx` | Adicionar card de fotos |
| `src/pages/eventos/SinistroAnalise.tsx` | Card azul de fotos do reboquista |
| `src/pages/sindicante/SindicanteCasoDetalhe.tsx` | Galeria somente-leitura |

## Sem alteracoes em

- Edge functions existentes
- Fluxo de auto-vistoria do associado
- Fotos do regulador

