
# Plano: Corrigir Fluxo de Manutenção de Rastreadores

## Problemas Identificados

### Problema 1: Modal de Agendamento Nao Abre
**Causa:** A opcao "Agendar Manutencao" so aparece no menu dropdown quando o rastreador tem status `instalado`. Rastreadores em status `estoque` nao mostram essa opcao.

**Comportamento Atual:**
- `ListaRastreadores.tsx` (linha 454): `{item.status === 'instalado' && (...)`
- `Rastreadores.tsx` (linha 538): `{rastreador.status === 'instalado' && (...)`

**Analise:** Isso e tecnicamente correto - um rastreador em estoque nao esta vinculado a um veiculo, entao nao faz sentido "agendar manutencao" para ele. Manutencao pressupoe que o rastreador esta instalado em um veiculo de um associado.

Se o coordenador precisa enviar um rastreador de **estoque** para verificacao/reparo, isso seria um processo diferente (nao uma "vistoria de manutencao").

### Problema 2: Manutencao Nao Aparece na Fila de Vistorias
**Causa:** A pagina `FilaVistorias` usa o hook `useVistorias()` que busca apenas da tabela `vistorias` com `tipo = 'entrada'`:

```typescript
// useVistorias.ts linha 68-77
.from('vistorias')
.eq('tipo', 'entrada')
```

Porem, manutencoes sao criadas na tabela `servicos` com `tipo = 'vistoria_manutencao'` (conforme `useCriarManutencao.ts`).

**Evidencia no banco:**
- Existe rastreador `RAT-862667083494305` com status `manutencao` 
- Nao existe nenhum registro correspondente na tabela `servicos` com esse rastreador
- A FilaVistorias nunca consultaria a tabela `servicos` de qualquer forma

## Solucao Proposta

### Fase 1: Permitir Manutencao de Rastreadores em Estoque

Alterar a condicao nos componentes para permitir "Agendar Manutencao" tambem para rastreadores em estoque, ja que podem precisar de verificacao/reparo antes de instalacao.

**Arquivos a modificar:**
1. `src/components/monitoramento/estoque/ListaRastreadores.tsx`
2. `src/pages/monitoramento/Rastreadores.tsx`

**Mudanca:**
```typescript
// ANTES
{item.status === 'instalado' && (

// DEPOIS
{(item.status === 'instalado' || item.status === 'estoque') && (
```

### Fase 2: Incluir Servicos de Manutencao na Fila de Vistorias

Atualizar `FilaVistorias` para buscar dados de ambas as fontes:
1. Tabela `vistorias` (vistorias de entrada)
2. Tabela `servicos` (manutencoes, retiradas)

**Arquivo a modificar:**
`src/pages/monitoramento/FilaVistorias.tsx`

**Abordagem:**
- Criar/usar hook que busca servicos de manutencao e retirada da tabela `servicos`
- Combinar os dados com as vistorias existentes
- Manter a mesma interface de `VistoriaFila` mapeando os campos de `servicos`

**Novo hook ou query:**
```typescript
// Buscar servicos de manutencao e retirada pendentes
const { data: servicosManutencoesRaw } = useServicos({
  tipo: ['vistoria_manutencao', 'vistoria_retirada'],
  status: ['pendente', 'agendada', 'em_rota', 'em_andamento']
});
```

**Mapeamento de servicos para VistoriaFila:**
```typescript
const servicosComoVistorias: VistoriaFila[] = (servicosManutencoesRaw || []).map(s => ({
  id: s.id,
  protocolo: s.protocolo || gerarProtocolo(s.id, s.created_at),
  cliente: s.associado?.nome || 'Sem associado',
  clienteId: s.associado_id || '',
  veiculo: `${s.veiculo?.marca || ''} ${s.veiculo?.modelo || ''}`.trim() || 'N/A',
  placa: s.veiculo?.placa || '---',
  tipo: mapTipo(undefined, s.tipo), // Usar tipoServico para detectar manutencao/retirada
  regiao: s.bairro || s.cidade || 'Nao informada',
  dataAgendada: s.data_agendada,
  vistoriador: s.profissional?.nome || null,
  vistoriadorId: s.profissional_id || null,
  status: mapStatus(s.status as any, undefined),
  createdAt: s.created_at,
}));
```

### Fase 3: Adicionar Filtros de Tipo para Manutencao/Retirada

Atualizar o seletor de tipo na FilaVistorias para incluir opcoes:
- Manutencao
- Retirada

**Arquivo a modificar:**
`src/pages/monitoramento/FilaVistorias.tsx`

```typescript
<SelectItem value="manutencao">Manutencao</SelectItem>
<SelectItem value="retirada">Retirada</SelectItem>
```

## Detalhes Tecnicos

### Arquivos a Modificar

1. **`src/components/monitoramento/estoque/ListaRastreadores.tsx`**
   - Linha 454: Alterar condicao para incluir `estoque`
   
2. **`src/pages/monitoramento/Rastreadores.tsx`**
   - Linha 538: Alterar condicao para incluir `estoque`

3. **`src/pages/monitoramento/FilaVistorias.tsx`**
   - Importar `useServicos` do hook existente
   - Adicionar query para buscar servicos de manutencao/retirada
   - Combinar os resultados com `vistoriasRaw` no useMemo
   - Adicionar opcoes de filtro para manutencao/retirada

### Impacto
- O coordenador podera enviar rastreadores em estoque para manutencao
- As manutencoes criadas aparecerao na Fila de Vistorias
- O vistoriador podera ver e executar as tarefas de manutencao

### Testes Recomendados
1. Verificar se opcao "Agendar Manutencao" aparece para rastreadores em estoque
2. Agendar uma manutencao e verificar se aparece na Fila de Vistorias
3. Verificar se os filtros de tipo funcionam corretamente
4. Testar fluxo completo do vistoriador recebendo tarefa de manutencao
