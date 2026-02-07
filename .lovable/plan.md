
# Plano: Ajustar Datas e Adicionar Opção de Encaixe no Agendamento de Manutenção

## Contexto

O modal `AgendarManutencaoModal` atual permite selecionar qualquer data futura sem restrições. O comportamento correto deve seguir a mesma lógica das vistorias de instalação:

1. **Datas limitadas**: Hoje + próximos 2 dias (excluindo domingos)
2. **Períodos com vagas**: Verificar disponibilidade de vagas por período
3. **Opção de encaixe**: Permitir ao Coordenador de Monitoramento ou Diretor habilitar "permite encaixe" no momento do agendamento

## Alterações Necessárias

### Arquivo: `src/components/monitoramento/manutencao/AgendarManutencaoModal.tsx`

#### 1. Importar dependências adicionais

Adicionar imports:
- `isSunday, isSaturday` de `date-fns`
- `useVagasPeriodo, temVagasDisponiveis` do hook de vagas
- `usePermissions` para verificar permissões
- `PERIODOS_DISPONIVEIS, LIMITE_VAGAS_POR_PERIODO, getPeriodosDisponivelsPorHora` de autovistoriaConfig
- `Puzzle` de lucide-react (icone para encaixe)

#### 2. Adicionar estado para encaixe

```typescript
const [permiteEncaixe, setPermiteEncaixe] = useState(false);
```

#### 3. Verificar permissões

```typescript
const { isDiretor, isCoordenadorMonitoramento } = usePermissions();
const podeHabilitarEncaixe = isDiretor || isCoordenadorMonitoramento;
```

#### 4. Configurar datas disponíveis

Substituir a lógica atual do calendário por:

```typescript
const dataMinima = new Date();
const dataMaxima = addDays(new Date(), 2);

const diasDesabilitados = (date: Date) => {
  return isSunday(date) || date < dataMinima || date > dataMaxima;
};
```

#### 5. Integrar verificação de vagas

```typescript
const dataFormatada = dataAgendada ? format(dataAgendada, 'yyyy-MM-dd') : null;
const { data: vagasData, isLoading: isLoadingVagas } = useVagasPeriodo(dataFormatada);

const periodosDisponiveis = useMemo(() => {
  if (!dataAgendada) return PERIODOS_DISPONIVEIS;
  return getPeriodosDisponivelsPorHora(dataAgendada);
}, [dataAgendada]);
```

#### 6. Mostrar vagas disponíveis nos períodos

Substituir o RadioGroup de períodos por cards que mostram vagas disponíveis (similar ao `EnviarManutencaoModal.tsx`).

#### 7. Adicionar checkbox de encaixe (apenas para Diretor/Coordenador)

```tsx
{podeHabilitarEncaixe && (
  <div className="flex items-center space-x-2 p-3 rounded-md bg-primary/5 border border-primary/20">
    <Checkbox
      id="encaixe"
      checked={permiteEncaixe}
      onCheckedChange={(checked) => setPermiteEncaixe(checked === true)}
    />
    <Label htmlFor="encaixe" className="font-normal cursor-pointer flex items-center gap-1">
      <Puzzle className="h-4 w-4" />
      Permitir encaixe de horário
    </Label>
  </div>
)}
```

#### 8. Enviar permite_encaixe no submit

Atualizar a interface `AgendarManutencaoParams` em `src/types/vistoriaManutencao.ts` para incluir:

```typescript
permiteEncaixe?: boolean;
```

E modificar a mutation em `useAgendarVistoriaManutencao` para salvar o campo:

```typescript
const updateData: Record<string, any> = {
  // ... campos existentes ...
  permite_encaixe: params.permiteEncaixe ?? false,
};
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/monitoramento/manutencao/AgendarManutencaoModal.tsx` | Limitar datas, mostrar vagas, adicionar checkbox encaixe |
| `src/types/vistoriaManutencao.ts` | Adicionar `permiteEncaixe` na interface `AgendarManutencaoParams` |
| `src/hooks/useVistoriaManutencao.ts` | Persistir `permite_encaixe` no banco |

## Resultado Esperado

1. Calendário mostra apenas hoje + próximos 2 dias (exceto domingos)
2. Períodos mostram quantidade de vagas disponíveis
3. Sábados mostram apenas período da manhã
4. Diretor e Coordenador de Monitoramento veem opção "Permitir encaixe"
5. O campo `permite_encaixe` é salvo na tabela `servicos`
