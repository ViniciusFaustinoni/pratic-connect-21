## Objetivo
Corrigir o erro de realocação do caso **KRF8B74** e eliminar a causa raiz que ainda deixa alguns serviços presenciais contaminados por vínculos de autovistoria.

## O que vou fazer

### 1) Higienizar os casos já contaminados
- Criar uma migration para corrigir os registros em `servicos` onde existe ao mesmo tempo:
  - `instalacao_origem_id` preenchido
  - `vistoria_origem_id` apontando para `vistorias.modalidade = 'autovistoria'`
- Para esses casos, remover o vínculo indevido de autovistoria do serviço presencial, preservando a instalação física correta.
- Validar especificamente o caso **KRF8B74**.

### 2) Fechar a causa raiz no banco
- Ajustar a função/trigger que sincroniza `vistorias -> servicos` para que ela **nunca anexe uma autovistoria** a um serviço presencial já existente.
- Manter a regra canônica já criada: autovistoria continua sendo artefato separado e nunca pode carregar `instalacao_origem_id`.
- Garantir que a materialização da vistoria presencial e da instalação física continue funcionando para motos que exigem rastreador.

### 3) Blindar a realocação
- Revisar a RPC `realocar_servico` para que ela opere apenas sobre o serviço físico canônico.
- Se houver metadado legado inconsistente, tratar de forma segura sem quebrar a realocação.
- Preservar auditoria e histórico.

### 4) Validar fim a fim
- Reconsultar os casos contaminados para confirmar que zeraram.
- Testar o cenário do **KRF8B74**.
- Confirmar que a tela de Serviços de Campo continua mostrando só o serviço canônico.

## Resultado esperado
- O **KRF8B74** volta a ser realocável normalmente.
- Serviços presenciais deixam de herdar `vistoria_origem_id` de autovistoria.
- A guarda nova de autovistoria continua ativa, mas passa a bloquear só cenários realmente inválidos.

## Detalhes técnicos
- Hoje encontrei **5 serviços contaminados** no banco; o KRF8B74 é um deles.
- O registro do KRF8B74 está como `tipo='vistoria_entrada'`, com `instalacao_origem_id` válido, porém ligado a uma `vistoria` de modalidade `autovistoria`.
- A trava que dispara o erro está correta; o problema é o dado/vínculo anterior estar incorreto.
- O ponto mais provável da contaminação está na trigger que, ao inserir `vistorias`, reaproveita serviço ativo por associado/veículo e faz `SET vistoria_origem_id = NEW.id` sem excluir `NEW.modalidade = 'autovistoria'`.

## Arquivos previstos
- Nova migration em `supabase/migrations/...`
- Ajuste na migration/função canônica que sincroniza `vistorias` com `servicos`
- Possível ajuste pontual na RPC `realocar_servico` se necessário para robustez