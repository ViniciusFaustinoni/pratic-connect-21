# Plano — Técnico vê só a etapa de instalação ao vir do link público

## Contexto

**Pergunta 2 (já implementado):** Técnicos só conseguem assumir uma instalação via link público depois que as fotos forem aprovadas pelo monitoramento. Isso é garantido em duas camadas:
- **UI** (`HomeEtapas` em `VistoriaPublica.tsx`): o botão "Realizar Instalação do Rastreador" só aparece quando `fotos_aprovadas_em` está preenchido.
- **Servidor** (edge function `assumir-instalacao-vistoria-link`): retorna 400 com "Fotos ainda não foram aprovadas pelo monitoramento" se tentarem assumir antes da aprovação.

Não há nada a mudar nesse ponto.

**Pergunta 1 (falta implementar):** Quando o técnico assume a instalação via link público, ele é redirecionado para `/instalador/vistoria/:id` (`ExecutarVistoriaCompleta.tsx`). Hoje essa tela renderiza **todas** as categorias (geral, motor, interior, instalação, rastreador) como se as fotos não tivessem sido feitas — duplicando o trabalho que o "qualquer um" já fez via link público.

Precisamos: quando a vistoria foi originada de um link público com fotos já aprovadas, ocultar as categorias visuais e mostrar **apenas** "instalação" e "rastreador" + checklist + finalização.

## Como detectar o modo

A função `agruparFotosApenasInstalacao(tipo)` já existe em `src/data/vistoriaConfigCompleta.ts` e retorna só as categorias `instalacao` e `rastreador`.

Detecção do modo dentro de `ExecutarVistoriaCompleta.tsx`:
1. Buscar em `vistoria_links` o registro com `instalacao_id = vistoria.instalacao_id`.
2. Se existir e `fotos_etapa_status === 'concluida'` e `fotos_aprovadas_em != null` → `modoApenasInstalacao = true`.

## Mudanças

### 1) Hook `useVistoriaLinkPorInstalacao`
Novo hook em `src/hooks/useVistoriaLinkPublica.ts` (ou arquivo próprio para área autenticada): consulta `vistoria_links` por `instalacao_id` retornando `fotos_aprovadas_em`, `fotos_etapa_status`, `fotos_executor_nome`, `fotos_rascunho_hodometro`, `fotos_rascunho_conferencia`. Usa o cliente autenticado normal (técnico está logado).

### 2) `ExecutarVistoriaCompleta.tsx`
- Chamar `useVistoriaLinkPorInstalacao(instalacaoId)`.
- Derivar `modoApenasInstalacao`.
- Substituir `agruparFotosFiltradas(...)` por `agruparFotosApenasInstalacao(tipo)` quando `modoApenasInstalacao` for true (mantém a lógica `veiculoPrecisaRastreador` para decidir se a categoria `rastreador` entra).
- Recalcular `totalFotosObrigatorias` e `totalFotosEnviadas` filtrando para essas categorias (usar `getFotosApenasInstalacao` para a lista base).
- **Pré-preencher** os campos já preenchidos pelo público (somente leitura/visualização):
  - Conferência (placa/chassi/modelo/cor) e hodômetro vindos do `vistoria_links` (rascunho ou registros oficiais).
  - Mostrar nome de quem fez as fotos (`fotos_executor_nome`) num badge informativo no topo: "Fotos enviadas por X — aprovadas pelo monitoramento".
- Validações de "podeAprovar" devem considerar apenas as fotos de instalação + rastreador (não exigir fotos visuais que já foram aprovadas).

### 3) Banner contextual no topo
Quando `modoApenasInstalacao === true`, exibir card informativo:
> "Etapa de fotos já aprovada pelo monitoramento. Você precisa realizar apenas a instalação do rastreador."

## Detalhes técnicos

- Reutilizar `agruparFotosApenasInstalacao` e `getFotosApenasInstalacao` (já existem).
- Não tocar em RLS — técnico autenticado já tem leitura de `vistoria_links` via policies existentes (verificar; se não, adicionar policy `SELECT` para roles `instalador_vistoriador`/`vistoriador_base` quando `tecnico_atribuido_id = auth.uid()`).
- Sem mudanças em edge functions.
- Sem migração de banco (colunas `fotos_aprovadas_em`, `fotos_executor_nome`, `fotos_rascunho_*` já existem).

## Não-objetivos

- Não mexer no fluxo padrão (sem link público) — continua mostrando tudo.
- Não mexer no gate de aprovação (já funciona conforme pedido).
- Não permitir que o técnico edite/refaça as fotos visuais já aprovadas (somente leitura).
