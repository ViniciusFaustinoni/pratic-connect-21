
# Plano: Ajustar Visibilidade dos Botões de Ação nas Propostas Pendentes

## Resumo das Regras de Negócio

### 1. Botão "Ativar Rastreador"
- **Na lista (PropostasPendentes.tsx):** Deve aparecer APENAS se o rastreador **não foi ativado** pelo vistoriador
- **Na análise (PropostaAnalise.tsx):** Mesmo comportamento - só exibir se não ativado

### 2. Botão "Enviar para SGA"
- **Na lista (PropostasPendentes.tsx):** REMOVER deste local
- **Na análise (PropostaAnalise.tsx):** ADICIONAR junto aos botões de ação (Aprovar, Solicitar Documentos, Reprovar)
- Deve desaparecer após envio com sucesso (quando `sincronizado_hinova = true`)

### 3. Botões "Aprovar Proposta" e "Solicitar Documentos"
- Devem desaparecer quando a proposta for **aprovada** (`status = 'ativo'`) ou **reprovada** (`status = 'reprovado'`)
- Atualmente já está parcialmente implementado, mas vou garantir a consistência

---

## Alterações por Arquivo

### Arquivo 1: `src/pages/cadastro/PropostasPendentes.tsx`

| Alteração | Descrição |
|-----------|-----------|
| Remover botão "Enviar para SGA" | Remover do menu dropdown (linhas 581-596) |
| Remover função `handleEnviarSGA` | Remover função (linhas 185-225) |
| Remover estado `enviandoSGAId` | Remover estado não utilizado (linha 173) |

### Arquivo 2: `src/pages/cadastro/PropostaAnalise.tsx`

| Alteração | Descrição |
|-----------|-----------|
| Adicionar botão "Enviar para SGA" | Adicionar na seção de Ações, junto com Aprovar/Solicitar/Reprovar |
| Esconder botão SGA quando sincronizado | Verificar `associado.sincronizado_hinova` |
| Adicionar verificação de status | Botões de ação só aparecem quando `status === 'assinado'` (já existente) |

### Arquivo 3: `src/hooks/usePropostasPendentes.ts`

| Alteração | Descrição |
|-----------|-----------|
| Incluir `sincronizado_hinova` no associado | Garantir que o campo está disponível para verificação |

---

## Detalhes Técnicos

### PropostasPendentes.tsx - Remoções

```typescript
// REMOVER: Linha 173 - Estado do SGA
const [enviandoSGAId, setEnviandoSGAId] = useState<string | null>(null);

// REMOVER: Linhas 185-225 - Função handleEnviarSGA
const handleEnviarSGA = async (proposta: PropostaPendente) => { ... }

// REMOVER: Linhas 581-596 - MenuItem do SGA no dropdown
{proposta.associado_id && !proposta.associado?.sincronizado_hinova && (
  <DropdownMenuItem onClick={...}>
    <Upload className="mr-2 h-4 w-4" />
    Enviar para SGA
  </DropdownMenuItem>
)}
```

### PropostaAnalise.tsx - Adições

```typescript
// ADICIONAR: Importar hook do SGA
import { supabase } from '@/integrations/supabase/client';
import { Upload, Loader2 } from 'lucide-react';

// ADICIONAR: Estado para controle do envio
const [enviandoSGA, setEnviandoSGA] = useState(false);

// ADICIONAR: Função handleEnviarSGA (similar à removida do outro arquivo)
const handleEnviarSGA = async () => { ... };

// ADICIONAR: Na seção de Ações (após botões de Aprovar/Solicitar/Reprovar)
// Condição: status === 'assinado' && !proposta.associado?.sincronizado_hinova
{proposta.status === 'assinado' && 
 !proposta.tem_documento_pendente && 
 !proposta.associado?.sincronizado_hinova && (
  <Button onClick={handleEnviarSGA}>
    <Upload className="mr-2 h-4 w-4" />
    Enviar para SGA
  </Button>
)}
```

### Condições de Visibilidade Atualizadas

```text
┌──────────────────────────────────────────────────────────────┐
│  BOTÃO              │ CONDIÇÃO DE EXIBIÇÃO                  │
├─────────────────────┼────────────────────────────────────────┤
│ Ativar Rastreador   │ instalacao_info &&                    │
│ (lista)             │ !instalacao_info.rastreador_ativado   │
├─────────────────────┼────────────────────────────────────────┤
│ Enviar para SGA     │ status === 'assinado' &&              │
│ (análise)           │ !tem_documento_pendente &&            │
│                     │ !associado.sincronizado_hinova        │
├─────────────────────┼────────────────────────────────────────┤
│ Aprovar Proposta    │ status === 'assinado' &&              │
│                     │ !tem_documento_pendente               │
├─────────────────────┼────────────────────────────────────────┤
│ Solicitar Docs      │ status === 'assinado' &&              │
│                     │ !tem_documento_pendente               │
├─────────────────────┼────────────────────────────────────────┤
│ Reprovar Proposta   │ status === 'assinado' &&              │
│                     │ !tem_documento_pendente               │
└──────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Estados

```text
┌─────────────────────────────────────────────────────────────┐
│  PROPOSTA ASSINADA (status = 'assinado')                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Botões visíveis:                                      │  │
│  │ ✓ Aprovar Proposta                                    │  │
│  │ ✓ Solicitar Documentos                                │  │
│  │ ✓ Reprovar Proposta                                   │  │
│  │ ✓ Enviar para SGA (se não sincronizado)               │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                  │
│           ┌──────────────┼──────────────┐                   │
│           ▼              ▼              ▼                   │
│      [Aprovar]     [Solicitar]     [Reprovar]               │
│           │              │              │                   │
│           ▼              ▼              ▼                   │
│     status='ativo'  (aguarda)    status='reprovado'         │
│           │                             │                   │
│           └──────────────┬──────────────┘                   │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Todos os botões de ação desaparecem                   │  │
│  │ Exibe apenas mensagem de status                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Tipo de Alteração |
|---------|-------------------|
| `src/pages/cadastro/PropostasPendentes.tsx` | Remover botão SGA e lógica associada |
| `src/pages/cadastro/PropostaAnalise.tsx` | Adicionar botão SGA na seção de Ações |

## Resultado Esperado

1. Na **lista de propostas**: Menu dropdown terá apenas "Analisar Proposta", "Ativar Rastreador" (condicional) e "Excluir Associado" (diretores)
2. Na **tela de análise**: Botão "Enviar para SGA" aparece junto com os outros botões de ação, e desaparece após sincronização
3. Botões de aprovação/solicitação desaparecem após a proposta ser aprovada ou reprovada
