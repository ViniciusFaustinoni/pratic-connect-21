

# Redesign da Página de Ativação com Fotos do Instalador e Autovistoria

## Problemas Identificados

1. **Fotos do instalador (31 fotos)** — O hook `useInstaladorData` busca fotos de `vistoria_fotos` via `vistorias.instalacao_id`, mas na resposta da API atual, `vistorias` retorna vazio (`[]`). As fotos existem vinculadas ao `servico`, mas a vistoria do instalador pode estar ligada de outra forma. Atualmente mostra "0 fotos".

2. **Fotos da autovistoria do associado** — Nunca são buscadas. Estão em `cotacoes_vistoria_fotos` (keyed by `cotacao_id`) ou em `vistoria_fotos` via `vistorias.contrato_id`. O hook não busca essas fotos.

3. **Vídeo 360° do associado** — Também não é buscado. Está em `vistorias.video_360_url` onde `contrato_id` ou `cotacao_id` match e `modalidade = 'autovistoria'`.

4. **Layout atual** — Cards empilhados na coluna esquerda sem organização clara, difícil de navegar.

## Solução

### 1. Hook — Buscar fotos de ambas as origens (`useVistoriaCompletaAnalise.ts`)

Expandir `useInstaladorData` para também buscar:

**A) Fotos do instalador (já existe, mas precisa fallback):**
- Buscar `vistorias` onde `instalacao_id = X` (já faz)
- Fallback: buscar fotos diretamente de `servicos` se a vistoria não existir (o servico pode ter fotos no checklist)

**B) Fotos/vídeo da autovistoria do associado (NOVO):**
- A partir do `instalacao.contrato_id` ou `instalacao.cotacao_id`:
  - Buscar `vistorias` onde `contrato_id = X` ou `cotacao_id = X` e `modalidade != 'presencial'` (autovistoria)
  - Se encontrar, buscar `vistoria_fotos` dessa vistoria e o `video_360_url`
  - Fallback: buscar `cotacoes_vistoria_fotos` pelo `cotacao_id`

Retornar dados separados:
```ts
// Dados do instalador
vistoriaInstalador: { fotos, video360Url, observacoes, kmAtual }
// Dados da autovistoria do associado  
autovistoria: { fotos, video360Url }
```

Para isso, o hook precisa buscar `contrato_id` e `cotacao_id` da instalação (adicionar na query principal de `useInstalacaoParaAnalise`).

### 2. Redesign da página (`VistoriaCompletaAnalise.tsx`)

Reorganizar em layout com **abas/seções** claras usando um design limpo:

**Layout proposto:**

```text
┌─────────────────────────────────────────────────────┐
│ Header: Ativação de Rastreador  [Badge Status]      │
│ Instalação #xxx • Placa ABC-1234                    │
├─────────────────────────────────────────────────────┤
│ [Banner de Recusa - se houver]                      │
├──────────────────────────┬──────────────────────────┤
│                          │ Status de Cobertura      │
│  RESUMO RÁPIDO           │ + Ações (Ativar/Voltar)  │
│  (Cliente + Veículo +    │                          │
│   Rastreador em formato  │                          │
│   compacto)              │                          │
├──────────────────────────┴──────────────────────────┤
│                                                     │
│ ┌─ Abas ──────────────────────────────────────────┐ │
│ │ [Instalação] [Autovistoria] [Checklist]         │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Aba "Instalação" (fotos do instalador):             │
│   Vídeo 360° + Grid de 31 fotos com labels         │
│   KM + Local de instalação + Assinatura             │
│   Observações/Ressalvas                             │
│                                                     │
│ Aba "Autovistoria" (fotos do associado):            │
│   Vídeo 360° do associado + Grid de fotos           │
│                                                     │
│ Aba "Checklist":                                    │
│   Checklist do instalador com status de cada item   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Detalhes visuais:**
- Resumo compacto no topo: dados do cliente, veículo e rastreador em formato horizontal/grid mais denso (sem cards separados enormes)
- Tabs usando o componente `Tabs` do shadcn para separar: "Fotos do Instalador", "Autovistoria do Associado", "Checklist e Detalhes"
- Grid de fotos maior (4-5 colunas) com labels claros e modal de zoom
- Identificação clara de quem fez: badge "Instalador: Nome" e "Associado: Nome" em cada seção
- Vídeo 360° com player nativo

### 3. Buscar `contrato_id` e `cotacao_id` da instalação

Adicionar esses campos na query principal de `useInstalacaoParaAnalise` para que o hook de autovistoria possa usá-los.

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/hooks/useVistoriaCompletaAnalise.ts` | Adicionar busca de fotos/vídeo da autovistoria do associado; retornar `contrato_id`/`cotacao_id`; separar dados instalador vs associado |
| `src/pages/cadastro/VistoriaCompletaAnalise.tsx` | Redesign completo com layout compacto + tabs (Instalação / Autovistoria / Checklist) + badges de identificação |

