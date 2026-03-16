

## Plano: Fluxo de Aprovação por Etapas (Stepper) na Análise de Propostas

### Problema Atual

A tela de análise de proposta mostra tudo de uma vez (documentos, fotos, botão de aprovar) sem guiar o analista por um fluxo lógico. O botão "Aprovar" fica disponível no header sem que o analista necessariamente tenha revisado documentos e fotos antes.

### Solução

Substituir o layout atual por um **fluxo de etapas (stepper)** com 3 passos obrigatórios na ordem:

```text
┌─────────────┐    ┌─────────────┐    ┌─────────────────┐
│  ETAPA 1    │ →  │  ETAPA 2    │ →  │    ETAPA 3       │
│ Documentos  │    │   Fotos     │    │ Aprovar R/F      │
│ (aprovar    │    │ (revisar    │    │ (confirmação     │
│  cada um)   │    │  vistoria)  │    │  final)          │
└─────────────┘    └─────────────┘    └─────────────────┘
```

### Regras do Fluxo

1. **Etapa 1 — Documentos**: O analista vê e aprova/reprova cada documento individualmente. Só avança quando TODOS os documentos estão aprovados (ou não há documentos pendentes).
2. **Etapa 2 — Fotos da Vistoria**: O analista revisa o vídeo 360°, galeria de fotos e observações do vistoriador. Marca como "Fotos Revisadas" para avançar.
3. **Etapa 3 — Liberação R/F**: Resumo final com checklist visual do que foi validado. Botão "Liberar Cobertura Roubo/Furto" (ou "Aprovar Proposta" se já tem instalação).

### Edições

**1. Criar `src/components/cadastro/proposta/PropostaApprovalStepper.tsx`**

Novo componente principal que substitui o layout atual da página `PropostaAnalise`. Contém:
- Barra de progresso visual com 3 etapas (números + ícones + labels)
- Etapa ativa destacada, etapas completas com checkmark verde
- Conteúdo condicional por etapa
- Botões "Avançar" / "Voltar" entre etapas
- Lógica de bloqueio: não avança da Etapa 1 se há documento pendente/reprovado

**2. Modificar `src/pages/cadastro/PropostaAnalise.tsx`**

- Reorganizar o layout para usar o stepper como estrutura principal
- Mover `DocumentosAnexadosPanel` para dentro da Etapa 1
- Mover `PropostaMidiaGrid` + `VistoriaObservacoesCard` para dentro da Etapa 2
- Mover os botões de ação (Aprovar/Reprovar/Solicitar Docs) para a Etapa 3
- O `PropostaHeroHeader` continua no topo mas SEM botões de ação (apenas info + navegação)
- `PropostaDetalhesTabs` (Cliente/Veículo/Contrato/Instalação) fica visível abaixo do stepper em todas as etapas como referência

**3. Modificar `src/components/cadastro/proposta/PropostaHeroHeader.tsx`**

- Remover os botões Aprovar/Reprovar/Solicitar Docs do header
- Manter apenas: navegação (Voltar/Próxima), avatar, nome, status, dados do veículo/plano

### UI do Stepper

- Horizontal em desktop, compacto em mobile
- 3 círculos conectados por linhas
- Círculo ativo: `bg-primary text-white`, Completo: `bg-success text-white` com CheckCircle, Pendente: `bg-muted text-muted-foreground`
- Etapa 1 bloqueada mostra badge vermelha "X documento(s) pendente(s)"
- Etapa 2 tem um checkbox/botão "Confirmo que revisei as fotos"
- Etapa 3 mostra resumo checklist e o botão final de aprovação (verde grande)

### Resultado

O analista é guiado por um fluxo lógico e intuitivo: primeiro valida documentos, depois revisa fotos, e só então pode aprovar. Isso reduz erros e garante que todas as verificações foram feitas.

