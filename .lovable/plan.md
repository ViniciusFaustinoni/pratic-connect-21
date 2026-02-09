

# Implementar Modal de Abertura de Retirada de Rastreador

## Contexto

O sistema já possui um modal de retirada (`EnviarRetiradaModal.tsx`) no menu Estoque, mas ele está incompleto: cria serviço sem atribuir profissional e não usa as novas colunas específicas de retirada adicionadas na migração anterior.

Esta implementação cria o ponto de entrada **correto** para retirada: um modal unificado (abertura + agendamento) acessado pelo menu **Rastreadores**, seguindo o mesmo padrão do modal `AgendarManutencaoUnificadoModal.tsx`.

---

## Arquivos a Criar

### 1. `src/components/monitoramento/retirada/AbrirRetiradaModal.tsx`

Modal unificado de abertura + agendamento de retirada. Estrutura baseada no modal de manutenção (`AgendarManutencaoUnificadoModal.tsx`).

**Seções do modal:**

1. **Dados do Rastreador** (automático, não editável)
   - Código, IMEI, Plataforma
   - Status de comunicação (online/offline)

2. **Dados do Associado** (automático, não editável)
   - Nome, CPF, Telefone
   - Veículo: marca modelo, placa

3. **Situação Financeira**
   - RadioGroup com 3 opções:
     - "Sem débitos pendentes"
     - "Com débitos" + input de valor
     - "Não verificado (prosseguir mesmo assim)"
   - Campo automático "Conferido por:" (usuário logado)

4. **Motivo da Retirada** (obrigatório)
   - Select com opções do tipo `MotivoRetirada`:
     - Cancelamento Voluntário
     - Inadimplência
     - Exclusão pela Diretoria
     - Substituição de Veículo
     - Busca e Apreensão

5. **Subtipo** (aparece se motivo = "substituicao_veiculo")
   - RadioGroup:
     - "Somente retirar"
     - "Retirar + Instalar no novo veículo"
   - Se escolher "Retirar + Instalar": input de busca de veículo por placa

6. **Agendamento**
   - Data (Calendar - hoje + 2 dias úteis)
   - Período (Manhã/Tarde com vagas)
   - Local de atendimento (Base / Volante)
   - Técnico responsável (Select com lista de profissionais)
   - Checkbox "Permitir encaixe"

7. **Notificação**
   - Checkbox "Notificar associado via WhatsApp"
   - Texto informativo sobre prazo de 48h

8. **Observações**
   - Textarea livre

**Botões:**
- Cancelar
- Agendar Retirada (primary, vermelho)

---

### 2. `src/hooks/useRetiradaRastreador.ts`

Novo hook com mutations e queries para retirada.

**Mutations:**

1. **useAbrirRetirada**
   - Parâmetros:
     - `rastreadorId`, `associadoId`, `veiculoId`
     - `motivo` (MotivoRetirada)
     - `subTipo` (SubTipoRetirada)
     - `temDebitosPendentes`, `valorDebitos`
     - `dataAgendada`, `periodo`, `localTipo`
     - `profissionalId`, `permiteEncaixe`
     - `notificarWhatsApp`
     - `observacoes`
     - `novoVeiculoId` (se substituição com nova instalação)
   
   - Ações:
     1. Atualiza rastreador.status → 'retirada_pendente'
     2. Registra movimentação em `estoque_movimentacoes`
     3. Insere em `servicos` com:
        - `tipo: 'vistoria_retirada'`
        - `status: 'agendada'`
        - Campos específicos: `motivo_retirada`, `sub_tipo_retirada`, `tem_debitos_pendentes`, `debitos_conferidos_por`, `debitos_conferidos_em`, `solicitado_por_modulo: 'monitoramento'`, `novo_veiculo_id`
     4. Se WhatsApp marcado: chama edge function de notificação
   
   - Invalidações: `lista-rastreadores`, `rastreadores-metricas`, `servicos`, `retiradas`

2. **useRetiradas** (query)
   - Lista serviços com `tipo = 'vistoria_retirada'`
   - Joins com: associados, veiculos, rastreadores, profiles
   - Filtros: status, motivo, data, profissional

---

## Arquivos a Modificar

### 3. `src/pages/monitoramento/Rastreadores.tsx`

**Mudanças:**
- Substituir import de `EnviarRetiradaModal` por `AbrirRetiradaModal`
- Atualizar tipo do estado `dialogRetirada` para incluir dados do associado e veículo
- Atualizar handler `handleWithdraw` para passar dados completos
- Atualizar renderização do modal

**Código atual (linha 27):**
```tsx
import { EnviarRetiradaModal } from '@/components/monitoramento/estoque/EnviarRetiradaModal';
```

**Mudar para:**
```tsx
import { AbrirRetiradaModal } from '@/components/monitoramento/retirada/AbrirRetiradaModal';
```

**Estado atual (linhas 271-277):**
```tsx
const [dialogRetirada, setDialogRetirada] = useState<{
  id: string;
  codigo: string;
  imei: string | null;
  status: 'estoque' | 'instalado' | 'manutencao' | 'baixado';
  veiculo: { placa: string; modelo: string | null } | null;
} | null>(null);
```

**Mudar para:**
```tsx
const [dialogRetirada, setDialogRetirada] = useState<{
  id: string;
  codigo: string;
} | null>(null);
```

**Modal atual (linhas 458-462):**
```tsx
<EnviarRetiradaModal
  open={!!dialogRetirada}
  onOpenChange={() => setDialogRetirada(null)}
  rastreador={dialogRetirada}
/>
```

**Mudar para:**
```tsx
<AbrirRetiradaModal
  open={!!dialogRetirada}
  onOpenChange={(open) => !open && setDialogRetirada(null)}
  rastreador={dialogRetirada}
/>
```

---

### 4. `src/components/rastreadores/RastreadorCard.tsx`

Verificar se a condição de exibição do botão de retirada está correta. Atualmente mostra para status `instalado`:

```tsx
{isInstalled && onWithdraw && (
```

Adicionar verificação de permissão diretamente no componente pai (RastreadoresContent).

---

### 5. `src/components/rastreadores/RastreadorTableView.tsx`

Verificar se o botão de retirada na tabela está condicionado a permissões.

---

### 6. Remover modal antigo (Opção A)

**Arquivo:** `src/components/monitoramento/estoque/EnviarRetiradaModal.tsx`

**Ação:** Remover o arquivo e suas referências. Como ele só é usado em `Rastreadores.tsx` e vamos substituí-lo, basta:
1. Não importar mais esse arquivo
2. Deletar o arquivo

---

## Validações Implementadas no Modal

| Campo | Obrigatório | Condição |
|-------|-------------|----------|
| Motivo da retirada | Sim | Sempre |
| Data | Sim | Sempre |
| Período | Sim | Sempre |
| Local | Sim | Sempre |
| Técnico | Sim | Sempre |
| Situação financeira | Sim | Pelo menos uma opção |
| Novo veículo | Condicional | Se motivo = substituição E subtipo = com nova instalação |

---

## Permissões

**Quem pode abrir retirada:**
- Diretor (`isDiretor`)
- Coordenador de Monitoramento (`isCoordenadorMonitoramento`)
- Admin Master (`isAdminMaster`)
- Desenvolvedor (`isDesenvolvedor`)

**Quem NÃO pode:**
- Instalador/Vistoriador
- Vendedor
- Analista de Cadastro (apenas visualiza)

A verificação será feita na página `Rastreadores.tsx` antes de passar o callback `onWithdraw`.

---

## Fluxo de Dados

```text
1. Coordenador clica em "Solicitar Retirada" no card/tabela
                    ↓
2. AbrirRetiradaModal abre com rastreador.id
                    ↓
3. Modal busca dados completos (rastreador + veículo + associado)
                    ↓
4. Coordenador preenche:
   - Situação financeira
   - Motivo
   - Subtipo (se substituição)
   - Data/Período/Local/Técnico
                    ↓
5. Ao confirmar:
   - useAbrirRetirada.mutate()
   - Rastreador → status: 'retirada_pendente'
   - Serviço criado com status: 'agendada'
   - Movimentação registrada
   - WhatsApp enviado (se marcado)
                    ↓
6. Modal fecha, lista atualiza
```

---

## Dependências Reutilizadas

| Componente/Hook | Origem | Uso |
|-----------------|--------|-----|
| `useProfissionaisEquipe` | useEquipe.ts | Lista de técnicos |
| `useVagasPeriodo` | useVagasPeriodo.ts | Vagas por período |
| `usePermissions` | usePermissions.ts | Verificação de permissões |
| `buscarVeiculoPorPlaca` | useVeiculos.ts | Busca de novo veículo |
| `PERIODOS_DISPONIVEIS` | autovistoriaConfig.ts | Configuração de períodos |
| Tipos de retirada | types/retirada.ts | MotivoRetirada, SubTipoRetirada, etc. |

---

## Checklist de Implementação

- [x] Criar pasta `src/components/monitoramento/retirada/`
- [x] Criar `AbrirRetiradaModal.tsx`
- [x] Criar `useRetiradaRastreador.ts`
- [x] Atualizar imports em `Rastreadores.tsx`
- [x] Atualizar estado e handler de retirada
- [x] Adicionar verificação de permissão no callback `onWithdraw`
- [x] Remover `EnviarRetiradaModal.tsx`
- [ ] Testar fluxo completo

