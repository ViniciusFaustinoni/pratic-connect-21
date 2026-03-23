

# Plano: Reformular Recusa para "Reportar Imprevisto"

## Resumo

Transformar o botao de recusa de tarefa de uma opcao rotineira para um recurso de emergencia, com motivos adequados, visual discreto e notificacao imediata ao coordenador.

---

## Alteracoes

### 1. `ModalRecusaTarefa.tsx` — Motivos, textos e botoes

- Renomear titulo de "Recusar Tarefa" para "Reportar Imprevisto"
- Substituir descricao pelo texto de alerta solicitado
- Substituir motivos por:
  1. Acidente ou emergencia pessoal
  2. Veiculo quebrado ou sinistro
  3. Problema de saude
  4. Outro imprevisto grave (abre campo texto obrigatorio)
- Alterar condicao do campo livre de `'Outro motivo'` para `'Outro imprevisto grave'`
- Botoes: "Confirmar imprevisto" (destructive) e "Cancelar"

### 2. `TarefaAtualCard.tsx` — Visual do botao (linhas 508-521)

Substituir o `<Button variant="outline">` por um link discreto abaixo do botao principal:

```tsx
<button
  type="button"
  onClick={handleRecusarClick}
  disabled={isRecusando}
  className="text-sm text-muted-foreground underline hover:text-destructive disabled:opacity-50"
>
  {isRecusando ? 'Reportando...' : 'Reportar Imprevisto'}
</button>
```

Remove o icone XCircle e o peso visual de botao.

### 3. `TarefaAtualCard.tsx` — Notificacao imediata (linhas 192-246)

Adicionar logo apos o insert em `registros_recusa_tarefa` (antes da verificacao de limite):

```typescript
// Notificacao imediata ao coordenador
const { data: coordenadores } = await supabase
  .from('user_roles')
  .select('user_id')
  .in('role', ['coordenador_monitoramento', 'admin']);

for (const coord of (coordenadores || [])) {
  await supabase.from('notificacoes').insert({
    user_id: coord.user_id,
    titulo: '🚨 Imprevisto reportado',
    mensagem: `${profile?.nome || 'Tecnico'} reportou: "${motivo}"${motivoLivre ? ` - ${motivoLivre}` : ''}. Instalacao #${tarefa.id.slice(0, 8)} retornou para a fila.`,
    tipo: 'alerta',
    subtipo: 'imprevisto_reportado',
    referencia_id: tarefa.id,
    referencia_tipo: 'servico',
    lida: false,
    canal_sistema: true,
    prioridade: 'alta',
  });
}
```

A logica existente de limite de recusas no turno permanece intacta como segunda camada de alerta.

### 4. `InstalacaoRotasConfig.tsx` — Label de configuracao

Atualizar o label "Exigir motivo ao recusar tarefa" para "Exigir motivo ao reportar imprevisto" (linha 677).

---

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| `src/components/vistoriador/ModalRecusaTarefa.tsx` | Novos motivos, titulo, descricao, botoes |
| `src/components/vistoriador/TarefaAtualCard.tsx` | Link discreto + notificacao imediata |
| `src/components/gestao-comercial/InstalacaoRotasConfig.tsx` | Label atualizado |

## Nao alterado

- Logica de retorno para fila (`status: 'pendente'`, `profissional_id: null`)
- Registro em `registros_recusa_tarefa`
- Alerta de limite de recusas no turno (mantido como camada adicional)

