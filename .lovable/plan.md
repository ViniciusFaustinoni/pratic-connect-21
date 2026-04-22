

## Adicionar ação "Realocar" no modal de detalhes de Serviços de Campo

### Por que não está disponível hoje
A função **já existe e funciona** — está implementada em `src/components/instalacoes/RealocarInstalacaoDialog.tsx` (com hook `useRealocarInstalacao` cobrindo realocar para rota e para base). Ela só foi ligada no **Mapa de Monitoramento** (`MapaVistoriasContent.tsx`), em dois pontos: ícone na linha da vistoria e botão dentro do popup do pin.

O modal usado em **Monitoramento → Serviços de Campo / Vistorias-Instalações** (`ServicoDetailModal.tsx`) foi criado como uma visualização "leve" focada em conferência (Ficha, WhatsApp, Maps, Ver no mapa) e nunca recebeu o botão. Não há razão técnica — é só falta de instrumentação.

### O que vou fazer

**1. Botão "Realocar" no header do modal** (`ServicoDetailModal.tsx`)
- Adicionar um botão na barra de ações rápidas, ao lado de "Ver no mapa".
- Visível apenas quando:
  - `servico.tipo === 'instalacao'` (ou `revistoria`), e
  - `status` ∈ `agendada | nao_compareceu | reagendada | cancelada` (mesmas regras do mapa, para manter paridade)
- Ícone `MapPinned` + label "Realocar".

**2. Abrir o `RealocarInstalacaoDialog` existente**
- Reutilizar exatamente o mesmo componente já validado no mapa — sem duplicar lógica.
- Passar `instalacaoId = servico.id`, `veiculoLabel = placa formatada`, `associadoNome = servico.associado?.nome`.
- Estado local `realocarOpen` no modal.

**3. Refresh após sucesso**
- O `useRealocarInstalacao` já invalida as queries de instalações/serviços/rotas, então a tabela de serviços de campo e o mapa atualizam automaticamente.

### Arquivos
- `src/components/servicos-campo/ServicoDetailModal.tsx` (único arquivo alterado — adiciona botão + monta o dialog)

### Fora do escopo
- Não vou criar um novo dialog de realocação (o existente já cobre rota + base + motivo + atribuição manual).
- Não vou mexer no mapa nem no hook de realocação.
- Sem alteração de regras de negócio (mesmas condições de status do mapa).

### Como testar (após aprovação)
Logar como diretor (`admin@teste.com`), abrir `/monitoramento/vistorias-instalacoes-mon`, clicar em uma instalação agendada/não-compareceu/reagendada → conferir botão "Realocar" no header → abrir o dialog → realocar para outra rota e validar que a vistoria some/aparece corretamente.

