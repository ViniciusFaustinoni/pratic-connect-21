
# Tela de Execucao da Vistoria do Regulador

## Resumo

Criar a pagina de execucao da vistoria de evento (`/regulador/vistoria/:id`) que o regulador acessa ao clicar "Iniciar Vistoria". A pagina e mobile-first e inclui: painel de dados completos do evento, captura de 10 fotos + 1 video, e modal fullscreen de orcamento com diagnostico e parecer.

---

## 1. Banco de Dados

Nenhuma nova tabela necessaria. A tabela `vistorias_evento` ja possui:
- `status` (text) para controlar o fluxo
- `dados_vistoria` (jsonb) para armazenar fotos, video, orcamento, diagnostico e parecer
- `iniciada_em` / `concluida_em` (timestamptz)
- `observacoes` (text)

O campo `dados_vistoria` armazenara a seguinte estrutura JSONB:

```text
{
  "fotos_urls": ["url1", ..., "url10"],
  "video_url": "url_video",
  "tipo_dano": "parcial" | "total",
  "descricao_tecnica": "texto",
  "itens_orcamento": [
    { "descricao": "...", "tipo": "peca|mao_de_obra|servico", "valor_unitario": 150, "quantidade": 2, "valor_total": 300 }
  ],
  "valor_total_orcamento": 2500,
  "parecer_tecnico": "texto",
  "recomendacao": "aprovar" | "analise_detalhada",
  "observacoes_perda_total": "texto" (se tipo_dano = total)
}
```

### Adicao de status no sinistro

O sinistro precisa suportar o status `aguardando_analise`. Verificar se o enum ja inclui esse valor; caso contrario, adicionar via migracao.

---

## 2. Edge Function: `salvar-vistoria-regulador`

Nova edge function autenticada (regulador deve estar logado) que recebe FormData com:
- `vistoria_id` -- ID da vistoria
- `acao` -- "iniciar", "salvar_midias", "finalizar"
- Arquivos (fotos e video)
- `dados` -- JSON com orcamento, diagnostico, parecer

### Acao "iniciar"
- Atualiza `vistorias_evento.status` para `em_andamento`
- Registra `iniciada_em = now()`

### Acao "salvar_midias"
- Faz upload de fotos/video para `sinistro-eventos/{vistoria_id}/vistoria-regulador/`
- Retorna URLs dos arquivos salvos
- Atualiza `dados_vistoria` parcialmente (fotos_urls, video_url)

### Acao "finalizar"
- Valida que existem 10 fotos e 1 video
- Salva orcamento completo em `dados_vistoria`
- Atualiza `vistorias_evento.status` para `concluida` e `concluida_em = now()`
- Atualiza `sinistros.status` para `aguardando_analise`
- Atualiza `sinistros.valor_orcamento` com o valor total do orcamento
- Atualiza `sinistros.tipo_dano` com o tipo de dano identificado

---

## 3. Pagina: `ExecutarVistoriaEvento.tsx`

Nova pagina em `src/pages/regulador/ExecutarVistoriaEvento.tsx`.

### Header
- Botao voltar
- Titulo "Vistoria de Evento"
- Badge com status

### Secao 1: Dados do Evento (Collapsible, aberto por padrao)

Paineis expansiveis organizados em:

**Associado:**
- Nome, CPF, telefone, email
- Plano e categoria do veiculo
- Status de adimplencia (buscar ultima cobranca)

**Veiculo:**
- Placa, Marca, Modelo, Ano, Cor
- Valor FIPE, Chassi

**Evento:**
- Tipo, data/hora informada, data/hora da comunicacao
- Tempo entre evento e comunicacao (calculado: "X dias e Y horas")
- Relato escrito do associado
- Audio do associado (player)
- Local do evento
- Dados do terceiro (se houver)

**Documentos:**
- Galeria de fotos da auto vistoria (etapa 1) com zoom (usando VisualizadorFoto existente)
- B.O. (imagem/PDF) com visualizador
- Numero e resumo do B.O.

### Secao 2: Captura de Evidencias

**Grade de 10 fotos:**
- Grid 2x5 ou 3+3+3+1 no mobile
- Cada slot numerado (1-10)
- Clique abre camera (reutiliza FotoCapture existente)
- Upload individual com feedback (spinner/check)
- Retry automatico em caso de falha

**Video (1 obrigatorio):**
- Componente VideoCapture existente (maxDuration=120)
- Upload com progresso

**Botao "Prosseguir para Orcamento":**
- Habilitado apenas quando 10 fotos + 1 video preenchidos
- Abre o modal de orcamento

### Secao 3: Modal de Orcamento (fullscreen mobile)

Dialog fullscreen com scroll interno:

**Diagnostico:**
- Seletor "Tipo de dano": Parcial / Total
- Se TOTAL: campo "Observacoes" e botao finalizar direto (sem itens de orcamento)
- "Descricao tecnica dos danos" (textarea)

**Itens do Orcamento (apenas parcial):**
- Lista dinamica de itens
- Cada item: descricao (texto), tipo (select: Peca/Mao de Obra/Servico), valor unitario, quantidade, valor total (auto)
- Botao "Adicionar Item"
- Rodape com soma total

**Parecer:**
- "Parecer tecnico" (textarea)
- "Recomendacao" (select: Recomendar Aprovacao / Recomendar Analise Detalhada)

**Botao "Finalizar Vistoria e Enviar Orcamento":**
- Salva tudo via edge function (acao "finalizar")
- Muda status vistoria para "concluida"
- Muda status sinistro para "aguardando_analise"
- Redireciona para lista de vistorias com toast de sucesso

---

## 4. Hook: `useVistoriaEventoDetalhe.ts`

Busca dados completos da vistoria com joins:
- `vistorias_evento` -> `sinistros` -> `associados` (com CPF, email, plano_id)
- `sinistros` -> `veiculos` (com chassi, valor_fipe)
- `sinistros` -> `sinistro_evento_links` (para dados das etapas: fotos, B.O., relato, audio)
- `associados` -> `planos` (nome do plano, categoria)

---

## 5. Arquivos a Criar

| Arquivo | Descricao |
|---|---|
| Migration SQL | Adicionar `aguardando_analise` ao enum de status do sinistro (se necessario) |
| `supabase/functions/salvar-vistoria-regulador/index.ts` | Upload de midias + finalizacao da vistoria |
| `src/pages/regulador/ExecutarVistoriaEvento.tsx` | Pagina principal de execucao |
| `src/components/regulador/VistoriaEventoDados.tsx` | Painel de dados do evento (associado, veiculo, documentos) |
| `src/components/regulador/VistoriaEventoMidias.tsx` | Grid de 10 fotos + video |
| `src/components/regulador/VistoriaEventoOrcamento.tsx` | Modal fullscreen de orcamento |
| `src/hooks/useVistoriaEventoDetalhe.ts` | Hook para buscar dados completos |

## 6. Arquivos a Modificar

| Arquivo | Mudanca |
|---|---|
| `src/App.tsx` | Rota `/regulador/vistoria/:id` |
| `src/pages/regulador/ReguladorVistorias.tsx` | Botao "Iniciar Vistoria" com navigate para a nova rota |
| `supabase/config.toml` | Adicionar `verify_jwt = false` para `salvar-vistoria-regulador` |

---

## 7. Upload Strategy

O regulador esta autenticado, mas para simplificar e manter consistencia com o padrao existente, os uploads vao pela edge function `salvar-vistoria-regulador` que usa `SUPABASE_SERVICE_ROLE_KEY`.

Fotos sao comprimidas no client (imageCompressor.ts) antes do envio. Cada foto e enviada individualmente para dar feedback de progresso. Em caso de falha, retry automatico (ate 3 tentativas).

Organizacao no bucket `sinistro-eventos`:
```text
sinistro-eventos/
  {vistoria_id}/
    vistoria-regulador/
      foto-01.jpg
      foto-02.jpg
      ...
      foto-10.jpg
      video.webm
```

---

## 8. Calculo do Tempo entre Evento e Comunicacao

```text
data_ocorrencia = sinistro.data_ocorrencia
data_comunicacao = sinistro.created_at

diferenca = data_comunicacao - data_ocorrencia

Se diferenca < 1 hora: "X minutos apos"
Se diferenca < 24 horas: "X horas apos"
Se diferenca >= 24 horas: "X dias e Y horas apos"
```
