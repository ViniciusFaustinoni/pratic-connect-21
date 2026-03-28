

# Exibir Dados do Instalador na Página de Ativação

## Problema
A página de ativação (`VistoriaCompletaAnalise.tsx`) mostra apenas dados cadastrais (cliente, veículo, rastreador, datas), mas não exibe nenhuma informação coletada pelo instalador durante a vistoria: fotos, vídeo 360, checklist, quilometragem, observações, assinatura do cliente e local de instalação.

## Solução

### 1. Expandir a query em `useVistoriaCompletaAnalise.ts`

Adicionar busca de:
- **Vistoria** vinculada à instalação (tabela `vistorias` via `instalacao_id`) — para pegar `video_360_url`, `km_atual`, `observacoes`
- **Fotos da vistoria** (tabela `vistoria_fotos` via `vistoria_id`) — todas as fotos tiradas pelo instalador
- **Serviço** vinculado (tabela `servicos` via `instalacao_origem_id`) — para pegar `checklist_data`, `quilometragem`, `assinatura_cliente_url`, `decisao_instalador`, `ressalvas_instalador`
- **Rastreador** com `local_instalacao`, `descricao_instalacao`, `foto_local_instalacao_url`

Retornar esses dados extras no hook para o componente consumir.

### 2. Atualizar `VistoriaCompletaAnalise.tsx`

Adicionar na coluna esquerda, abaixo dos cards existentes:

- **Card "Checklist do Instalador"** — exibir cada item do `checklist_data` com ícone de check/X e observações
- **Card "Quilometragem"** — mostrar KM registrado (do serviço ou da vistoria)
- **Card "Local de Instalação"** — mostrar local selecionado, descrição do ponto exato e foto do local
- **Card "Observações do Instalador"** — observações e ressalvas
- **Card "Fotos da Vistoria"** — grid de thumbnails clicáveis com labels (reutilizando padrão de `AprovacaoInstalacaoDetalhe`)
- **Card "Vídeo 360°"** — player de vídeo quando houver
- **Card "Assinatura do Cliente"** — imagem da assinatura

Tudo read-only, sem ações de edição. Layout similar ao que já existe em `AprovacaoInstalacaoDetalhe.tsx`.

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/hooks/useVistoriaCompletaAnalise.ts` | Buscar vistoria, fotos, serviço e dados do rastreador expandidos |
| `src/pages/cadastro/VistoriaCompletaAnalise.tsx` | Renderizar fotos, vídeo, checklist, KM, local, assinatura e observações |

