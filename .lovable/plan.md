Plano para corrigir o fluxo SGA após auto vistoria

Diagnóstico confirmado
- Hoje a aprovação de proposta em `supabase/functions/aprovar-proposta/index.ts` atualiza o contrato e o associado como `ativo` e dispara `sga-hinova-sync` logo após a aprovação de cadastro.
- A função `sga-hinova-sync` cadastra associado e veículo no Hinova, mas não diferencia o status operacional desejado para o SGA entre “pendente” e “ativo”. Ao fim, grava localmente `veiculos.status_sga = 'ativado_sga'`.
- Existe outro ponto de ativação em `src/hooks/useAtivacoes.ts` que ativa contrato/associado e envia ao SGA; este fluxo deve continuar sendo o ponto correto para ativação final após instalação do rastreador, mas precisa evitar enviar como ativo antes da hora.

Regra desejada
```text
Auto vistoria realizada/aprovada
  -> enviar ao SGA como PENDENTE
  -> NÃO ativar associado no SGA
  -> NÃO considerar Proteção 360 ativa por isso

Instalação do rastreador concluída
  -> ativar contrato/associado no sistema
  -> atualizar/enviar ao SGA como ATIVO
  -> liberar Proteção 360 e mensagem de ativação
```

Implementação proposta

1. Ajustar a função `sga-hinova-sync`
- Adicionar um parâmetro explícito no body, por exemplo `status_sga_destino: 'pendente' | 'ativo'`.
- Quando chamado com `pendente`:
  - cadastrar/garantir o associado e o veículo no Hinova;
  - enviar o payload com o status/código de situação pendente conforme mapeamento Hinova já disponível no projeto;
  - gravar localmente `veiculos.status_sga = 'pendente_sga'`;
  - manter `sincronizado_hinova = true` apenas para indicar que o cadastro existe no Hinova, não que está ativo.
- Quando chamado com `ativo`:
  - manter o comportamento de ativação final;
  - gravar `veiculos.status_sga = 'ativado_sga'`.
- Registrar nos `sga_sync_logs` qual modo foi usado, para auditoria: `pendente` ou `ativo`.

2. Corrigir `aprovar-proposta`
- Remover a ativação antecipada do associado/contrato quando ainda não há instalação concluída e o plano exige rastreador.
- Para caso com auto vistoria e rastreador pendente:
  - deixar associado em status intermediário, como `aguardando_instalacao`;
  - deixar contrato assinado/aprovado, mas não como ativação final se ainda depende da instalação;
  - chamar `sga-hinova-sync` com `status_sga_destino: 'pendente'`.
- Se a instalação já estiver concluída no momento da aprovação, chamar como `ativo`, preservando o caso excepcional já existente.
- Para plano sem necessidade de rastreador, manter ativação imediata se essa for a regra atual do produto.

3. Corrigir o fluxo de ativação pós-instalação
- Em `src/hooks/useAtivacoes.ts`, ao concluir/ativar após instalação do rastreador:
  - atualizar contrato/associado para `ativo`;
  - chamar `sga-hinova-sync` com `status_sga_destino: 'ativo'`;
  - exibir mensagem de sucesso apenas quando for ativação final.
- Se o veículo já tiver sido cadastrado no SGA como pendente, a função deve reaproveitar `codigo_hinova` e apenas atualizar a situação para ativo, sem duplicar cadastro.

4. Ajustar UI/status público se necessário
- Garantir que a tela pública não mostre “ativo” apenas porque a auto vistoria foi concluída ou enviada ao SGA como pendente.
- Mostrar mensagem compatível: “Cadastro aprovado. Aguardando instalação do rastreador para ativação da Proteção 360.”
- A mensagem “Proteção 360 ativada” deve aparecer somente após instalação/ativação final.

5. Auditoria de compatibilidade
- Revisar chamadas existentes de `sga-hinova-sync` para definir explicitamente o modo correto:
  - aprovação de cadastro/auto vistoria: `pendente`;
  - ativação pós-instalação: `ativo`;
  - ações manuais de sincronização devem informar claramente se são pendente ou ativo, ou manter padrão seguro como pendente quando ainda não houver instalação.

Arquivos principais
- `supabase/functions/sga-hinova-sync/index.ts`
- `supabase/functions/aprovar-proposta/index.ts`
- `src/hooks/useAtivacoes.ts`
- Possíveis ajustes pontuais na tela pública de acompanhamento, se ela depender diretamente de `associados.status` ou `contratos.status` para mostrar ativação.

Validação
- Testar cenário com auto vistoria + rastreador obrigatório: SGA recebe/cadastra como pendente, associado não fica ativo antes da instalação.
- Testar instalação concluída: associado fica ativo, SGA muda para ativo, tela pública mostra Proteção 360 ativada.
- Testar plano sem rastreador obrigatório: fluxo atual de ativação imediata permanece funcional.
- Conferir logs `sga_sync_logs` para garantir que não há duplicidade no SGA e que o modo enviado está auditável.