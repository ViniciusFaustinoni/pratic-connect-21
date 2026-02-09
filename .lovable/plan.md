

# Plano: Melhorar Tela de Execução de Retirada (ExecutarRetirada.tsx)

## 📋 Resumo Executivo

Este plano modifica a tela existente `ExecutarRetirada.tsx` (459 linhas) para adicionar funcionalidades críticas que o técnico precisa no campo, seguindo os padrões já estabelecidos em `ExecutarManutencao.tsx`.

---

## 🔍 Análise do Estado Atual

### O que já existe em ExecutarRetirada.tsx:
- Header com botões de contato (WhatsApp, telefone)
- Conferência de dados do veículo (placa, chassi, modelo, cor)
- Upload de fotos por categorias (usando FotoCapture)
- Upload de vídeo 360° (usando VideoCapture)
- Assinatura do cliente (usando SignaturePad)
- Campo de observações
- Botão "Concluir Retirada" que chama edge function `concluir-retirada`
- Modal de confirmação após conclusão
- Barra de progresso de fotos

### O que FALTA:
1. Seção de localização do rastreador (fotos da instalação original)
2. Informações do motivo e sub-tipo da retirada
3. Botão "Cheguei no Local" (mudança de status agendada → em_andamento)
4. Checklist específico de retirada
5. Seleção de integridade do aparelho
6. Botão "Associado Ausente"
7. Validação de fotos mínimas (3 obrigatórias)
8. Lógica diferenciada para aparelho danificado (→ retorno_base)

---

## 📦 Modificações Planejadas

### 1. Nova Query: Buscar Fotos da Instalação Original

Adicionar query para buscar o serviço de instalação anterior do rastreador:

```typescript
// Nova query - buscar instalação original do rastreador
const { data: instalacaoOriginal } = useQuery({
  queryKey: ['instalacao-original', rastreador?.id],
  queryFn: async () => {
    if (!rastreador?.id) return null;
    
    // Buscar último serviço de instalação concluído deste rastreador
    const { data, error } = await supabase
      .from('servicos')
      .select(`
        id, observacoes, created_at, checklist_data,
        profissional:profiles!profissional_id(nome)
      `)
      .eq('rastreador_id', rastreador.id)
      .eq('tipo', 'instalacao')
      .eq('status', 'concluida')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) return null;
    
    // Buscar fotos associadas (se existirem)
    const { data: fotos } = await supabase
      .from('servico_fotos')
      .select('tipo, arquivo_url')
      .eq('servico_id', data.id);
    
    return { ...data, fotos: fotos || [] };
  },
  enabled: !!rastreador?.id,
});
```

**Localização**: Linha ~39-57, após a query principal do serviço

---

### 2. Nova Seção: Localização do Rastreador (Topo)

Componente visual a ser adicionado no início da `<main>`:

```text
┌─────────────────────────────────────────────────────────────┐
│  📍 LOCALIZAÇÃO DO RASTREADOR NO VEÍCULO                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [foto1]  [foto2]  [foto3]  (fotos da instalação)          │
│                                                             │
│  Observação do instalador: "Instalado atrás do              │
│  porta-luvas, lado esquerdo, preso com abraçadeira"         │
│                                                             │
│  ℹ️ Data da instalação: dd/mm/aaaa                           │
│  ℹ️ Instalador: [nome de quem instalou]                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Se não houver fotos**: Mostrar alerta amarelo com "⚠️ Fotos de instalação não encontradas. Consulte o coordenador antes de prosseguir."

**Localização**: Linha ~293, início da `<main>` antes de "Conferência de Dados"

---

### 3. Nova Seção: Informações do Serviço de Retirada

Mostrar dados específicos da retirada já agendada:

- **Motivo**: Badge colorido (Cancelamento = cinza, Inadimplência = vermelho, etc.)
- **Sub-tipo**: "Somente Retirada" ou "Retirada + Nova Instalação"
- **Se substituição com nova instalação**: Dados do novo veículo (placa, modelo)
- Nome do associado, telefone, placa atual

**Localização**: Após seção de localização, antes de "Conferência de Dados"

---

### 4. Adicionar Botão "Cheguei no Local"

Seguir padrão de `ExecutarManutencao.tsx` (linhas 382-410):

```typescript
// Importar hook
import { useIniciarServicoMutation } from '@/hooks/useServicos';

// No componente
const { mutate: iniciarServico, isPending: isIniciando } = useIniciarServicoMutation();

const handleCheguei = () => {
  if (servicoId) {
    iniciarServico(servicoId, {
      onSuccess: () => {
        toast.success('Chegada registrada! Agora você pode realizar a retirada.');
      }
    });
  }
};

// Status check
const isAgendada = servico?.status === 'agendada';
const isEmAndamento = servico?.status === 'em_andamento';
```

**UI**: Botão grande azul "Cheguei no Local" visível quando status = 'agendada'. Após clique, libera as seções de execução.

**Localização**: Footer da página ou antes da seção de conferência

---

### 5. Novo Componente: ChecklistRetirada

Criar componente similar a `ChecklistManutencao.tsx`:

```typescript
// src/components/instalador/ChecklistRetirada.tsx

const CHECKLIST_RETIRADA_ITEMS = [
  { id: 'acabamento_desmontado', label: 'Acabamento do veículo desmontado com cuidado', description: 'Remover painéis necessários sem danificar' },
  { id: 'rastreador_localizado', label: 'Rastreador localizado e removido', description: 'Encontrar e desconectar o equipamento' },
  { id: 'fios_isolados', label: 'Fios cortados e isolados corretamente', description: 'Sem risco de curto-circuito' },
  { id: 'chip_removido', label: 'Chip removido do módulo', description: 'Retirar SIM card do rastreador' },
  { id: 'acabamento_recolocado', label: 'Acabamento do veículo recolocado', description: 'Painéis e acabamentos no lugar' },
  { id: 'integridade_verificada', label: 'Aparelho verificado visualmente', description: 'Checar estado físico do rastreador' },
];
```

**Comportamento**:
- Progresso com barra visual
- Checkboxes grandes (mobile-friendly)
- Salva em `checklist_retirada` (JSONB)
- Botão de resultado só habilitado quando 100%

**Localização novo arquivo**: `src/components/instalador/ChecklistRetirada.tsx`
**Localização na tela**: Após botão "Cheguei no Local", antes das fotos

---

### 6. Validar Mínimo de 3 Fotos Obrigatórias

Modificar lógica de fotos para exigir pelo menos 3:
1. Rastreador removido (aparelho na mão)
2. Fios isolados no veículo
3. Acabamento recolocado

```typescript
// Fotos obrigatórias específicas de retirada
const FOTOS_RETIRADA_OBRIGATORIAS = [
  { id: 'rastreador_removido', nome: 'Rastreador Removido', obrigatoria: true },
  { id: 'fios_isolados', nome: 'Fios Isolados', obrigatoria: true },
  { id: 'acabamento_recolocado', nome: 'Acabamento Recolocado', obrigatoria: true },
];

// Validação
const fotosRetiradaCompletas = FOTOS_RETIRADA_OBRIGATORIAS
  .every(f => fotosEnviadas[f.id]);
```

**Localização**: Modificar a seção de fotos existente (linhas 330-377)

---

### 7. Nova Seção: Integridade do Aparelho

Select obrigatório após fotos:

```text
┌─────────────────────────────────────────────────────────────┐
│  📋 ESTADO DO APARELHO RETIRADO                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Como está o aparelho?                                      │
│                                                             │
│  ( ) ✅ Íntegro (bom estado, pode voltar ao estoque)        │
│  ( ) ⚠️ Danificado (dano físico visível)                    │
│  ( ) 🔓 Violado (sinais de abertura/adulteração)            │
│  ( ) 💧 Molhado/Oxidado (umidade ou oxidação)               │
│                                                             │
│  [Se não íntegro: campo de observação obrigatório]          │
│  [Alerta: "Multa de R$400 será sugerida automaticamente"]   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Estado**:
```typescript
const [integridade, setIntegridade] = useState<IntegridadeAparelho | null>(null);
const [obsIntegridade, setObsIntegridade] = useState('');
```

**Localização**: Após seção de fotos, antes do vídeo 360°

---

### 8. Modificar Edge Function concluir-retirada

A edge function existente envia o rastreador para `status: 'estoque'` sempre. Precisamos adicionar lógica para:

- Se `integridade === 'integro'`: rastreador → `estoque`
- Se `integridade !== 'integro'`: rastreador → `retorno_base` (triagem)
- Se `sub_tipo === 'retirada_com_nova_instalacao'`: criar novo serviço de instalação

**Modificações no body da requisição**:
```typescript
body: {
  servicoId,
  rastreadorId: rastreador.id,
  veiculoId: veiculo.id,
  profissionalId: profile.id,
  hodometro: parseInt(hodometro),
  assinaturaUrl,
  observacoes: observacoes.trim() || undefined,
  // NOVOS CAMPOS:
  integridade,
  obsIntegridade: integridade !== 'integro' ? obsIntegridade : undefined,
  checklistRetirada: checklistItems,
  videoUrl,
  fotosUrls: Object.values(fotosEnviadas),
  criarNovaInstalacao: servico.sub_tipo_retirada === 'retirada_com_nova_instalacao',
  novoVeiculoId: servico.novo_veiculo_id,
}
```

**Localização edge function**: `supabase/functions/concluir-retirada/index.ts`

---

### 9. Adicionar Botão "Associado Ausente"

Similar a `ExecutarManutencao.tsx` (linhas 429-444):

```typescript
const handleNaoCompareceu = async () => {
  if (!servicoId) return;
  
  // Usar hook de marcar não compareceu (pode ser reaproveitado de manutenção)
  // OU criar mutation inline:
  const { error } = await supabase
    .from('servicos')
    .update({
      status: 'nao_compareceu',
      updated_at: new Date().toISOString(),
    })
    .eq('id', servicoId);
  
  if (error) {
    toast.error('Erro ao registrar ausência');
    return;
  }
  
  // Rastreador continua como 'retirada_pendente'
  toast.success('Registrado como não compareceu. Coordenador será notificado.');
  navigate('/vistoriador/tarefas');
};
```

**UI**: Botão outline laranja "Associado Ausente" visível quando status = 'em_andamento'

**Localização**: No footer, ao lado do botão "Concluir Retirada"

---

### 10. Validação Final Antes de Concluir

Atualizar condição `podeConfirmar`:

```typescript
const podeConfirmar = 
  conferenciaCompleta &&           // Dados conferidos
  checklistCompleto &&             // 6 itens do checklist OK
  fotosRetiradaCompletas &&        // 3 fotos obrigatórias
  videoEnviado &&                  // Vídeo 360° OK
  assinaturaEnviada &&             // Assinatura OK
  integridade !== null &&          // Integridade selecionada
  (integridade === 'integro' || obsIntegridade.trim().length > 0); // Obs se danificado
```

---

## 📁 Arquivos a Modificar

| Arquivo | Tipo | Ação |
|---------|------|------|
| `src/pages/instalador/ExecutarRetirada.tsx` | Página | Modificar extensivamente |
| `src/components/instalador/ChecklistRetirada.tsx` | Componente | **CRIAR NOVO** |
| `supabase/functions/concluir-retirada/index.ts` | Edge Function | Modificar para novos campos |
| `src/types/retirada.ts` | Tipos | Já existe, usar os tipos definidos |

---

## 📊 Fluxo Atualizado da Tela

```text
1. Técnico abre ExecutarRetirada (status = 'agendada')
              ↓
2. VÊ: Localização do rastreador (fotos + obs da instalação)
              ↓
3. VÊ: Informações do serviço (motivo, sub-tipo, dados)
              ↓
4. CLICA: "Cheguei no Local" → status = 'em_andamento'
              ↓
5. LIBERA: Checklist de retirada (6 itens)
              ↓
6. LIBERA: Upload de fotos (mínimo 3)
              ↓
7. SELECIONA: Integridade do aparelho
              ↓
8. GRAVA: Vídeo 360°
              ↓
9. CAPTURA: Assinatura do cliente
              ↓
10. CLICA: "Concluir Retirada" 
    OU: "Associado Ausente" (se não compareceu)
              ↓
11. Edge function processa:
    - Se íntegro: rastreador → estoque
    - Se danificado: rastreador → retorno_base
    - Se substituição: cria novo serviço instalação
```

---

## 🔒 Permissões

A tela já é acessada apenas por profissionais com serviços atribuídos. Nenhuma modificação de permissão necessária.

---

## ⚠️ Considerações Técnicas

1. **Fotos de instalação inexistentes**: O banco atual não tem registros de `instalacao_fotos` ou `servico_fotos` para instalações. O código deve exibir graciosamente o alerta "Fotos não encontradas".

2. **Hook useIniciarServicoMutation**: Já existe e pode ser reutilizado de `useServicos.ts`.

3. **Reaproveitamento**: O componente `ChecklistRetirada` seguirá a mesma estrutura de `ChecklistManutencao.tsx`, facilitando manutenção.

4. **Edge function**: Modificar para aceitar novos parâmetros sem quebrar chamadas existentes (retrocompatibilidade).

---

## ✅ Checklist de Implementação

- [ ] Criar query para buscar instalação original do rastreador
- [ ] Adicionar seção "Localização do Rastreador" no topo
- [ ] Adicionar seção "Informações do Serviço"
- [ ] Importar e usar `useIniciarServicoMutation` para botão "Cheguei"
- [ ] Criar componente `ChecklistRetirada.tsx`
- [ ] Integrar checklist na tela
- [ ] Modificar seção de fotos para validar 3 obrigatórias
- [ ] Adicionar seção de seleção de integridade
- [ ] Adicionar botão "Associado Ausente"
- [ ] Atualizar validação `podeConfirmar`
- [ ] Modificar `handleConcluir` para enviar novos campos
- [ ] Atualizar edge function `concluir-retirada` para novos campos
- [ ] Testar fluxo completo

