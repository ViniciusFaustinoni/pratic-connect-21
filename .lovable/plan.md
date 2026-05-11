## Objetivo

Reorganizar os passos finais do tutorial **Troca de Titularidade** (`src/data/tutoriais/troca-titularidade.ts`) para refletir com mais granularidade o fluxo real, separando responsabilidades de cada área e do novo associado.

## Mudanças nos passos

Mantém os passos **1 a 6** intactos. Substitui os atuais 7, 8 e 9 por **6 passos novos (7 a 12)**:

### 7 — Cadastro envia o Termo de Cancelamento
Cadastro abre Cadastro › Processos › Titularidade e dispara o Termo de Cancelamento (e-mail + biometria facial via Autentique) para o titular **antigo**. A solicitação fica "aguardando assinatura do termo".
- Dica: enquanto o termo não chega assinado, nada avança.
- Link: Cadastro › Processos › Titularidade.

### 8 — Novo associado assina o contrato
(reposicionar o foco no novo titular) — pelo link público o novo dono finaliza a assinatura biométrica do contrato dele. Caso ele ainda não tenha assinado no passo 6, esta é a etapa final dele antes da aprovação. Cobertura segue suspensa.
- Dica: assinatura é facial obrigatória (PF_FACIAL).

> Observação: como o passo 6 já cobre "novo titular escolhe plano, envia documentos e assina", confirmar com o usuário se este passo 8 deve focar na **assinatura do Termo de Cancelamento pelo titular antigo** (mais coerente com a sequência) ou realmente em uma segunda assinatura do novo. Ver pergunta abaixo.

### 9 — Cadastro aprova
Com termo assinado pelo antigo e contrato assinado pelo novo, Cadastro aprova a solicitação em Cadastro › Processos › Titularidade. Marca `cadastro_aprovado=true` e libera para Monitoramento.
- Dica: débitos em aberto no SGA do antigo travam a aprovação.

### 10 — Monitoramento aprova a vistoria
A solicitação cai em Monitoramento › Aprovações › Aprovação de Associados. Monitoramento valida documentos/fotos prévias e libera para vistoria de campo.
- Link: Monitoramento › Aprovações.

### 11 — Atribuição manual e vistoria do técnico
Em Monitoramento › Serviços de Campo › **Atribuição Manual**, o serviço (origem "troca de titularidade", encaixe) é atribuído ao técnico. O técnico vai até o veículo e realiza a **vistoria de conferência** (sem instalar — o rastreador já existe). Resultado volta para aprovação final.
- Dica: vistoria de troca é só fotográfica, sem instalação.
- Links: Monitoramento › Serviços de Campo, Mapa.

### 12 — Conclusão e criação de senha pelo novo associado
Após aprovação da vistoria, edge function `efetivar-troca-titularidade` cancela o contrato antigo, ativa o novo, transfere o veículo, religa cobertura e sincroniza no SGA (Pendente). O **novo associado** vê no link público o convite para **criar a senha de acesso ao app** e, ao definir a senha, a troca de titularidade é considerada **concluída**.
- Dica: SGA fica Pendente; promoção a Ativo é manual no painel SGA.
- Link: Cadastro › Associados.

## Arquivo afetado

- `src/data/tutoriais/troca-titularidade.ts` — substitui os 3 últimos itens do array `steps` pelos 6 novos.

## Pergunta antes de implementar

O passo **8** que você descreveu ("passo do associado novo - o associado assina") parece duplicar o passo 6 atual ("Novo titular escolhe plano, envia documentos e assina"). Preciso confirmar a intenção para não criar redundância.