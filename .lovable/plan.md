

# Página Pública de Vistoria Prestador — Redesign Completo

## Resumo

Reescrever `VistoriaPrestador.tsx` com design mobile-first completo, reutilizando componentes existentes (`ChecklistItem`, `FotoCapture`, `SignaturePad`), e adicionar colunas ao `vistoria_prestador_links` para armazenar checklist, fotos e assinatura.

## Migration SQL

Adicionar colunas à tabela `vistoria_prestador_links`:

- `checklist_data` jsonb DEFAULT null — armazena estado do checklist
- `fotos_vistoria` jsonb DEFAULT null — array de URLs das fotos enviadas
- `assinatura_url` text DEFAULT null — URL da assinatura do associado

Criar bucket de storage `vistoria-prestador-fotos` (público) se não existir, com política RLS permitindo upload anon.

## Componente `VistoriaPrestador.tsx` — Reescrita

### Dados carregados

- `vistoria_prestador_links` pelo token (com join em `instalacoes`, `associados`, `veiculos`)
- Rastreadores vinculados: query em `instalacoes` → `rastreador_id` para buscar código/modelo do rastreador

### 4 Estados

**Estado 1 — Validando**: Spinner + "Validando acesso..."

**Estado 2 — Inválido**: Ícone cadeado, "Link inválido", mensagem, sem botões. Exibido quando token não existe, ou status é `concluida` ou `cancelada`.

**Estado 3 — Tela principal** (status `aguardando` ou `em_execucao`):

- Header: Logo PraticCar + tag "VISTORIA EXTERNA"
- Seção 1 — Dados da instalação (card): marca/modelo/ano, placa em destaque, endereço, data/hora, associado
- Seção 2 — Equipamentos para instalação: rastreador(es) vinculados (somente leitura)
- Seção 3 — Checklist: Reutilizar `ChecklistItem` com `CHECKLIST_ITEMS` (mesmos itens do `InstaladorChecklist`). Estado salvo via auto-save em `checklist_data` da tabela
- Seção 4 — Fotos: Reutilizar `FotoCapture` com as categorias de `vistoriaConfigCompleta`. Upload para bucket `vistoria-prestador-fotos`. Mínimo de fotos obrigatórias
- Seção 5 — Assinatura: Reutilizar `SignaturePad`. Upload do blob para storage, URL salva em `assinatura_url`
- Botão fixo no rodapé: "Finalizar Vistoria" — habilitado quando checklist 100% + mínimo fotos + assinatura. AlertDialog de confirmação antes de concluir.

**Estado 4 — Concluído**: Check verde, "Vistoria concluída!", "Os dados foram enviados ao coordenador."

### Fluxo de conclusão

Ao confirmar: atualizar `vistoria_prestador_links` com `status: 'concluida'`, `concluida_em`, `checklist_data`, `fotos_vistoria` (array de URLs), `assinatura_url`. Qualquer acesso futuro ao token exibe Estado 2.

### Diferenças do fluxo interno

- Não tem etapa de "Confirmar Chegada" separada — o prestador já está na tela principal
- Ao abrir a página com status `aguardando`, automaticamente muda para `em_execucao` e registra `chegada_em`
- Componentes reutilizados mas com tema claro (fundo branco) em vez do tema escuro do instalador

## Arquivos

| Arquivo | Ação |
|---------|------|
| Migration SQL | **Criar** — colunas + bucket |
| `src/pages/public/VistoriaPrestador.tsx` | **Reescrever** — Página completa com 4 estados |

