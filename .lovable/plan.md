## Completar tutorial "Troca de Titularidade" até a ativação

Hoje o tutorial em `src/data/tutoriais/troca-titularidade.ts` para no passo 4 (cadastrar novo titular). Vou estender com os passos que vão do envio do link até a ativação do novo associado, mantendo o ponto de vista do **vendedor/operador comercial** e referenciando o tutorial do Cadastro já existente para não duplicar conteúdo.

### Novos passos a adicionar (5 a 9)

5. **Envie o link da proposta para o novo titular** — após salvar, a cotação aparece em Cotações › Outros Processos com badge "Troca de Titularidade". Copiar link público (WhatsApp/e-mail) ou usar o disparo automático.

6. **Novo titular preenche e assina** — descreve o que o novo dono faz no link público: escolher plano (carência preservada herdada do contrato antigo), enviar documentos, assinar contrato com biometria facial. Indicar que a cotação muda para "Aguardando aprovação Cadastro".

7. **Cadastro envia o Termo de Cancelamento e aprova** — resumo curto + link "Ver tutorial completo" apontando para `/tutoriais/aprovacao-troca-titularidade-cadastro`. Mencionar que a assinatura do termo pelo titular antigo libera o veículo (anti-sequestro).

8. **Monitoramento agenda e aprova a vistoria de campo** — explicar que ao aprovar Cadastro, é criado automaticamente um serviço de vistoria em Monitoramento › Serviços de Campo (origem `troca_titularidade`). O técnico fotografa, e Monitoramento › Aprovações › Aprovação de Associados decide.

9. **Ativação automática do novo associado** — quando a vistoria é aprovada, o sistema executa `efetivar-troca-titularidade`: cancela contrato antigo, ativa o novo, transfere o veículo, religa cobertura e sincroniza no SGA Hinova. O novo titular passa a constar como ativo em Cadastro › Associados.

### Implementação

Editar **somente** `src/data/tutoriais/troca-titularidade.ts`:
- Acrescentar 5 itens em `steps`.
- Sem novas imagens (deixo `imagem` ausente nos passos novos — o componente já lida com isso; caso prefira, posso reutilizar imagens já existentes em `src/assets/tutoriais/` como `associado-assinatura-email.png`, `associado-vistoria-base-data.png`).
- Adicionar `links` apontando para rotas reais: `/vendas/cotacoes`, `/cadastro/processos?tab=titularidade`, `/monitoramento/servicos-campo`, `/monitoramento/aprovacoes`, `/cadastro/associados`.
- Atualizar `tempoEstimadoMin` de 6 → 10.

### Fora de escopo
- Não criar novos assets de imagem.
- Não mexer em backend, hooks ou no tutorial do Cadastro (já cobre o seu próprio fluxo).