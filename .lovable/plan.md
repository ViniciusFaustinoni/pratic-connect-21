## Problema

O modal "Confirmar Aprovação" do Cadastro promete:
- "Ativar o associado no sistema"
- "Liberar acesso ao App do Associado"
- "O cliente receberá uma notificação sobre a aprovação."

Isso é falso para esta etapa. Conforme a regra core do projeto, a aprovação do Cadastro é **apenas análise documental**: define `contratos.cadastro_aprovado=true` na edge `aprovar-proposta`, mas **não** promove o associado/veículo/contrato a `ativo`, **não** envia para o SGA Hinova e **não** libera o app. A ativação real acontece somente depois, na fila `Monitoramento › Aprovações › Aprovação de Associados`, via edge `ativar-associado` (após a instalação/vistoria concluir).

A ramificação `isAutovistoria` do mesmo modal também está incorreta ao dizer "Ativar cobertura de Roubo e Furto" — cadastro não ativa cobertura nenhuma.

## Solução (apenas UI/copy)

Arquivo: `src/pages/cadastro/PropostaAnalise.tsx` (linhas ~680–733), no `<AlertDialogDescription>` do modal de aprovação.

### Novo conteúdo (vale para os dois ramos: autovistoria e padrão)

Título do modal mantém "Confirmar Aprovação".

Texto:

> Esta etapa é **apenas a análise documental**. Ao confirmar, o sistema irá:

Lista (substitui os dois itens atuais):
- Ícone `FileCheck` (success): **Marcar a documentação como aprovada pelo Cadastro**
- Ícone `ArrowRightCircle` (info): **Encaminhar a proposta para a fila de Monitoramento › Aprovação de Associados**

Bloco informativo (variant warning/muted, ícone `Info`), texto fixo:

> A **ativação do associado**, o envio como pendente para o **SGA** e a **liberação do acesso ao App** ocorrem somente após a aprovação do Monitoramento, depois da instalação/vistoria concluída.

Remover as frases:
- "Ativar o associado no sistema"
- "Liberar acesso ao App do Associado"
- "O cliente receberá uma notificação sobre a aprovação."
- (Ramo autovistoria) "Ativar cobertura de Roubo e Furto" e o bloco "Pendente (após instalação do rastreador): Proteção 360º" / "A Proteção 360º será ativada automaticamente após a instalação..."

Ramo `isAutovistoria` passa a usar a mesma copy do ramo padrão (a lógica de cobertura é igual: nada é ativado aqui).

Botão de ação muda de "Confirmar Aprovação" para **"Aprovar Documentação"** para reforçar o escopo.

## Fora de escopo

- Nenhuma mudança em edge functions, banco, fluxo de WhatsApp ou em `aprovar-proposta`.
- Nenhuma mudança no stepper, badges ou nos demais cards da tela.
