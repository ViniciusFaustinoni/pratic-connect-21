
# Plano de Revisao Completa da Area Juridico

## Diagnostico Atual

Apos analise detalhada de todas as paginas, hooks e componentes da area juridica:

### Status do Banco de Dados
- **0 processos** cadastrados
- **0 advogados** cadastrados
- **0 prazos** registrados
- **0 audiencias** agendadas
- **0 consultas juridicas**

### O que esta funcionando corretamente
- **Dashboard**: KPIs reais, alertas de prazos, proximas audiencias, ultimos andamentos
- **ProcessosList**: CRUD completo com filtros e estatisticas dinamicas
- **ProcessoForm**: Formulario completo para criar/editar processos (vincula com Associados e Sinistros)
- **PrazosControl**: Controle completo com filtros, cumprir prazo
- **AudienciasAgenda**: Calendario + lista, filtros, registrar resultado
- **ConsultasJuridicas**: Lista com filtros, responder consultas
- **AdvogadosList**: Cards com filtros e estatisticas
- **NovoAndamentoModal**: Cria andamento e prazo simultaneamente
- **ResponderConsultaModal**: Salva rascunho ou responde consulta

### NAO HA DADOS MOCK
Todos os dados vem do banco de dados real (Supabase).

---

## Problemas Identificados

| # | Problema | Arquivo | Impacto |
|---|----------|---------|---------|
| 1 | Dropdown "Editar Processo" usa handleNotImplemented | ProcessoDetalhe.tsx | Botao nao funciona |
| 2 | Acoes do dropdown (Suspender/Arquivar/Encerrar) nao implementadas | ProcessoDetalhe.tsx | Status nao pode ser alterado |
| 3 | Botao "Nova Audiencia" na tab nao abre modal | ProcessoDetalhe.tsx | NovaAudienciaModal existe mas nao conectado |
| 4 | Botao "Upload Documento" na tab nao abre modal | ProcessoDetalhe.tsx | UploadDocumentoModal existe mas nao conectado |
| 5 | Botao "Novo Prazo" na tab - modal nao existe | ProcessoDetalhe.tsx | Funcionalidade faltando |
| 6 | Botao "Nova Custa" na tab - modal nao existe | ProcessoDetalhe.tsx | Funcionalidade faltando |
| 7 | Rota /juridico/consultas/nova nao existe | App.tsx | Erro 404 ao clicar |
| 8 | NovoAndamentoModal invalida query errada | NovoAndamentoModal.tsx | Dados nao atualizam |

---

## Correcoes Necessarias

### 1. ProcessoDetalhe.tsx - Conectar Dropdown Actions

**Linha 167-180**: Substituir `handleNotImplemented` por funcoes reais

```typescript
// Adicionar states
const [novaAudienciaOpen, setNovaAudienciaOpen] = useState(false);
const [uploadDocumentoOpen, setUploadDocumentoOpen] = useState(false);
const [novoPrazoOpen, setNovoPrazoOpen] = useState(false);
const [novaCustaOpen, setNovaCustaOpen] = useState(false);

// Adicionar mutation para alterar status
const alterarStatusMutation = useMutation({
  mutationFn: async (novoStatus: string) => {
    const { error } = await supabase
      .from('processos')
      .update({ status: novoStatus, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['processos'] });
    toast.success('Status do processo atualizado!');
    navigate('/juridico/processos');
  },
  onError: (e) => toast.error('Erro: ' + e.message),
});

// No dropdown:
<DropdownMenuItem onClick={() => navigate(`/juridico/processos/${id}/editar`)}>
  Editar Processo
</DropdownMenuItem>
<DropdownMenuItem onClick={() => alterarStatusMutation.mutate('suspenso')}>
  Suspender Processo
</DropdownMenuItem>
<DropdownMenuItem onClick={() => alterarStatusMutation.mutate('arquivado')}>
  Arquivar Processo
</DropdownMenuItem>
```

### 2. ProcessoDetalhe.tsx - Conectar Modais Existentes

**Imports a adicionar**:
```typescript
import { NovaAudienciaModal } from '@/components/juridico/NovaAudienciaModal';
import { UploadDocumentoModal } from '@/components/juridico/UploadDocumentoModal';
import { NovoPrazoModal } from '@/components/juridico/NovoPrazoModal'; // Criar
import { NovaCustaModal } from '@/components/juridico/NovaCustaModal'; // Criar
```

**Conectar botoes nas tabs**:
```typescript
// Tab Audiencias (linha 520)
<Button onClick={() => setNovaAudienciaOpen(true)}>
  <Plus className="h-4 w-4 mr-2" />
  Nova Audiencia
</Button>

// Tab Documentos (linha 586)
<Button onClick={() => setUploadDocumentoOpen(true)}>
  <Plus className="h-4 w-4 mr-2" />
  Upload Documento
</Button>

// Tab Prazos (linha 446)
<Button onClick={() => setNovoPrazoOpen(true)}>
  <Plus className="h-4 w-4 mr-2" />
  Novo Prazo
</Button>

// Tab Custas (linha 635)
<Button onClick={() => setNovaCustaOpen(true)}>
  <Plus className="h-4 w-4 mr-2" />
  Nova Custa
</Button>
```

**Renderizar modais**:
```typescript
<NovaAudienciaModal 
  open={novaAudienciaOpen} 
  onClose={() => setNovaAudienciaOpen(false)} 
  processoId={id!} 
/>
<UploadDocumentoModal 
  open={uploadDocumentoOpen} 
  onClose={() => setUploadDocumentoOpen(false)} 
  processoId={id!} 
/>
<NovoPrazoModal 
  open={novoPrazoOpen} 
  onClose={() => setNovoPrazoOpen(false)} 
  processoId={id!} 
/>
<NovaCustaModal 
  open={novaCustaOpen} 
  onClose={() => setNovaCustaOpen(false)} 
  processoId={id!} 
/>
```

---

### 3. Criar NovoPrazoModal

**Novo arquivo**: `src/components/juridico/NovoPrazoModal.tsx`

```typescript
// Modal para criar prazo avulso (sem andamento vinculado)
// Campos: descricao, data_inicio, data_fim (ou dias), prioridade, responsavel
// Mutation insere em processos_prazos
```

---

### 4. Criar NovaCustaModal

**Novo arquivo**: `src/components/juridico/NovaCustaModal.tsx`

```typescript
// Modal para registrar custa/honorario
// Campos: tipo (select), descricao, valor, data_vencimento
// Mutation insere em processos_custas
```

---

### 5. Corrigir NovoAndamentoModal - Query Invalidation

**Arquivo**: `src/components/juridico/NovoAndamentoModal.tsx`
**Linha 143**: Corrigir invalidacao

```typescript
// ANTES (bug)
queryClient.invalidateQueries({ queryKey: ['processo', processoId] });

// DEPOIS (correto)
queryClient.invalidateQueries({ queryKey: ['processos', processoId, 'andamentos'] });
queryClient.invalidateQueries({ queryKey: ['processos', processoId] });
```

---

### 6. Resolver Rota "Nova Consulta"

Em vez de criar rota separada, modificar os componentes para abrir modal:

**Dashboard** e **ConsultasJuridicas**: Substituir navegacao por estado de modal

```typescript
// Adicionar state
const [novaConsultaOpen, setNovaConsultaOpen] = useState(false);

// Mudar botao
<Button onClick={() => setNovaConsultaOpen(true)}>
  <Plus className="mr-2 h-4 w-4" />
  Nova Consulta
</Button>

// Renderizar modal
<NovaConsultaModal 
  open={novaConsultaOpen} 
  onClose={() => setNovaConsultaOpen(false)} 
/>
```

---

## Resumo das Alteracoes

| Arquivo | Tipo | Alteracao |
|---------|------|-----------|
| `src/pages/juridico/ProcessoDetalhe.tsx` | Pagina | Conectar dropdown + modais |
| `src/components/juridico/NovoPrazoModal.tsx` | **Novo** | Modal para criar prazo |
| `src/components/juridico/NovaCustaModal.tsx` | **Novo** | Modal para criar custa |
| `src/components/juridico/NovoAndamentoModal.tsx` | Componente | Corrigir query invalidation |
| `src/pages/juridico/JuridicoDashboard.tsx` | Pagina | Modal Nova Consulta |
| `src/pages/juridico/ConsultasJuridicas.tsx` | Pagina | Modal Nova Consulta |

---

## Integracoes Existentes (NAO MEXER)

A area Juridico ja possui integracao com:

1. **Sinistros**: ProcessoForm usa SinistroCombobox para vincular processo a sinistro
2. **Associados**: ProcessoForm usa AssociadoCombobox para vincular processo a associado
3. **Profiles**: Responsavel, criado_por, enviado_por - todos vinculados corretamente

**Nao e necessario alterar outras areas do sistema.**

---

## Verificacao Pos-Implementacao

1. Abrir ProcessoDetalhe e testar:
   - Editar Processo (deve navegar)
   - Suspender/Arquivar/Encerrar (deve atualizar status)
2. Testar cada tab:
   - Nova Audiencia (modal deve abrir)
   - Novo Prazo (modal deve abrir)
   - Upload Documento (modal deve abrir)
   - Nova Custa (modal deve abrir)
3. Testar Dashboard e ConsultasJuridicas:
   - Botao "Nova Consulta" deve abrir modal
4. Criar um processo de teste com:
   - Andamento (com e sem prazo)
   - Audiencia
   - Documento
   - Custa
5. Verificar se os dados aparecem corretamente nas listagens
