

# Plano: Remover botões manuais da aba Instalações (monitoramento)

Assim como foi feito na aba Vistorias, a aba Instalações é apenas para acompanhamento -- as instalações entram automaticamente no sistema. Botões de criação manual e o dialog de formulário devem ser removidos.

## Alterações em `src/pages/monitoramento/Instalacoes.tsx`

1. **Remover botão "Nova Instalação" do header** (linhas 103-106)
2. **Alterar texto descritivo** (linha 100) de "Gerencie os agendamentos de instalação" para "Acompanhe os agendamentos de instalação de rastreadores"
3. **Remover botão "Agendar Instalação" do estado vazio** (linhas 188-191) e alterar texto para "As instalações agendadas aparecerão aqui automaticamente"
4. **Remover `InstalacaoFormDialog`** (linhas 304-308) e todo estado/funções relacionados: `showFormDialog`, `editInstalacaoId`, `handleNewInstalacao`, `handleEdit`
5. **Remover `onEdit` do `InstalacaoDetailDrawer`** (linha 315) -- o drawer continua para visualização, mas sem opção de editar
6. **Limpar imports**: remover `Plus`, `InstalacaoFormDialog`

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/monitoramento/Instalacoes.tsx` | Remover botões manuais, dialog de formulário e funções de criação/edição |

