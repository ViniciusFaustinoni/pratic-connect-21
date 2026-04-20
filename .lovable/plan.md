

## Botão "Alterar Endereço ou Tipo" para o Coordenador

Adiciona um botão único nos cards de tarefa do **Mapa de Monitoramento** e da página **Serviços de Campo** que abre um modal permitindo ao Coordenador alterar livremente: **endereço completo**, **técnico atribuído** e **tipo de agendamento (Rota ↔ Base)**.

### Onde aparece o botão
- **Mapa** (`MapaVistoriasContent.tsx`): no card lateral, na coluna de ações (junto a `Locate`, `UserPlus`, `Send`), ícone `Pencil` — visível somente quando `!isRealizada` e o usuário tem permissão `canManagePlanos` ou perfil de Coordenador de Monitoramento.
- **Serviços de Campo › Atribuição Manual** (`AtribuicaoManualTab.tsx`): mesmo botão dentro do `DraggableServico`, posicionado fora da área de drag.
- **Serviços de Campo › Instalações** (`InstalacoesList.tsx`): novo item no `DropdownMenu` existente — "Alterar endereço ou tipo".
- **Serviços de Campo › Vistorias** (`VistoriaListItem.tsx`): novo botão de menu compacto à direita do card.

### Novo componente: `AlterarEnderecoTipoDialog.tsx` em `src/components/mapa/`

Props:
```ts
{
  open: boolean;
  onOpenChange(open: boolean): void;
  servicoId: string | null;            // id em servicos
  agendamentoBaseId?: string | null;   // id em agendamentos_base (se origem = base)
  origem: 'rota' | 'base';
  resumo: { placa?: string; associadoNome?: string };
  onSuccess?(): void;
}
```

Layout do modal (3 seções colapsáveis, salvas num único submit):

1. **Endereço** (apenas para origem='rota' ou se converter para 'rota'):
   - CEP, Logradouro, Número, Complemento, Bairro, Cidade, UF
   - Botão "Buscar CEP" usa `viacep.com.br/ws/{cep}/json/` (fetch direto, sem nova dep).
   - Geocodificar via `supabase.functions.invoke('geocode-endereco', { body: {...} })` — função já existe — para popular `latitude`/`longitude`.

2. **Técnico**:
   - Reusa `useVistoriadoresAtivos()` num `Command` searchable + opção "Sem técnico (deixar para o painel)".
   - Mostra badge Rota/Base do dia (via `useAlocacoesDiaHoje`).

3. **Tipo de agendamento**:
   - Toggle `Rota` | `Base`.
   - Se `Base`: mostra `Select` de oficina (reusar `useBasesPratic`) e `Input` de horário.
   - Se mudar de Rota → Base: o Coordenador escolhe a oficina e horário; coordenadas/endereço passam a ser irrelevantes (oficina já tem local).
   - Se mudar de Base → Rota: o Coordenador deve preencher endereço (validação obriga).

### Hook novo: `useAlterarEnderecoTipo.ts`

Mutation única que executa em ordem:
- Se `tipoNovo === origem`:
  - **Rota**: `UPDATE servicos SET logradouro, numero, complemento, bairro, cidade, cep, latitude, longitude, profissional_id WHERE id = servicoId`
  - **Base**: `UPDATE agendamentos_base SET oficina_id, horario, atendido_por WHERE id = agendamentoBaseId`
- Se converter **Rota → Base**:
  1. `INSERT INTO agendamentos_base (cotacao_id?, instalacao_id?, vistoria_id?, cliente_nome, cliente_telefone, veiculo_placa, veiculo_descricao, data_agendada, horario, oficina_id, atendido_por, status='confirmado', observacoes='Convertido de rota')` lendo dados do `servicos` original.
  2. `UPDATE servicos SET status='convertido_base', profissional_id=null, observacoes += '[Convertido para Base em ...]'`.
  3. Invalidate queries de ambos os lados.
- Se converter **Base → Rota**:
  1. `INSERT INTO servicos (...)` reaproveitando dados do `agendamentos_base` + endereço fornecido + `tipo` deduzido (default `vistoria`) + `data_agendada/hora_agendada` derivada do horário escolhido.
  2. `UPDATE agendamentos_base SET status='convertido_rota', atendido_por=null, observacoes += '[Convertido para Rota em ...]'`.
- Sempre registra em `servicos_atribuicoes_log` com `tipo_atribuicao='manual'` quando técnico mudar.
- Invalida: `vistorias-mapa`, `servicos-para-atribuir-manual`, `vistoriadores-ativos-manual`, `tarefa-atual`, `vistoriadores-localizacao-realtime`, `calendario-dia-base`.

### Permissão
Mesma regra de `useAtribuirServicoManual`: usuário autenticado com `canManagePlanos` ou role Coordenador de Monitoramento. Botão só renderiza se `useConfigAtribuicaoManual()` ou `usePermissions().canManagePlanos`.

### Realtime
`UPDATE` no `servicos` propaga via canais existentes (`useServicosRealtime`, `useVistoriasMapa.refetchInterval=60s`). App do técnico que perdeu a tarefa recebe `profissional_id=null` e a tarefa some automaticamente.

### Sem novas dependências, sem mudança de schema
- Schema já tem todos os campos necessários (verificado: `servicos.logradouro/numero/complemento/bairro/cidade/cep/latitude/longitude/origem`; `agendamentos_base.oficina_id/horario/atendido_por`).
- ViaCEP é fetch público direto.
- Geocodificação reutiliza edge function `geocode-endereco` existente.

### Arquivos tocados
- **Novo**: `src/components/mapa/AlterarEnderecoTipoDialog.tsx`
- **Novo**: `src/hooks/useAlterarEnderecoTipo.ts`
- **Editado**: `src/components/mapa/MapaVistoriasContent.tsx` (botão `Pencil` + state + render do dialog)
- **Editado**: `src/components/monitoramento/AtribuicaoManualTab.tsx` (botão no card)
- **Editado**: `src/pages/monitoramento/InstalacoesList.tsx` (item no DropdownMenu)
- **Editado**: `src/components/vistorias/VistoriaListItem.tsx` (botão compacto)

### Validação após deploy
1. Mapa › card de instalação na rota → clicar `Pencil` → trocar CEP/número → salvar → ver pin reposicionado e endereço atualizado no card.
2. Mesma tarefa → trocar técnico via lista → toast de sucesso → tarefa aparece no painel do novo técnico, some do anterior.
3. Mesma tarefa → mudar para "Base" + escolher oficina "Pratic Recreio" + horário 14:00 → confirmar → tarefa some do mapa de rotas e aparece em `Atribuição Manual › Vistorias Base` da oficina selecionada.
4. Tarefa de Base → converter para Rota com endereço novo → confirma criação em `servicos`, com lat/lng populados pelo `geocode-endereco`.
5. Conferir log em `servicos_atribuicoes_log` quando o técnico mudar.

