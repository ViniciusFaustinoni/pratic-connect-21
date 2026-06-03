# Rede Veículos API v2 — Referência

Total: **22 endpoints** (todos POST).

| Grupo | Endpoint | Descrição |
|---|---|---|
| [vinculo](./vinculo.md) | `/vincularClienteVeiculo` | Realizar o vínculo do equipamento ao cliente e veículo. |
| [vinculo](./vinculo.md) | `/desvincularClienteVeiculo` | Realizar o desvinculo do equipamento e liberar para outra instalação. |
| [cliente](./cliente.md) | `/atualizarDadosCliente` | Atualizar os dados de cadastro do cliente. |
| [cliente](./cliente.md) | `/preCadastroCliente` | Atualizar os dados de cadastro do veículo. |
| [cliente](./cliente.md) | `/ativarCliente` | Marcar o status do cliente como ativo. |
| [cliente](./cliente.md) | `/inativarCliente` | Marcar o status do cliente como inativo. O cliente não poderá mais acessar o sis |
| [cliente](./cliente.md) | `/obterStatusCliente` | Obter o status atual do cliente. |
| [cliente](./cliente.md) | `/obterDadosCliente` | Obter os dados do cadastro do cliente. |
| [cliente](./cliente.md) | `/permitirAcessoSistema` | Permitir acesso do cliente ao sistema. |
| [cliente](./cliente.md) | `/removerAcessoSistema` | Remover o acesso do cliente ao sistema. |
| [cliente](./cliente.md) | `/redefinirSenhaCliente` | Redefinir a senha atual do cliente para a senha inicial. |
| [veiculo](./veiculo.md) | `/atualizarDadosVeiculo` | Atualizar os dados de cadastro do veículo. |
| [veiculo](./veiculo.md) | `/preCadastroVeiculo` | Atualizar os dados de cadastro do veículo. |
| [veiculo](./veiculo.md) | `/ativarVeiculo` | Marcar o status do veículo como ativo. |
| [veiculo](./veiculo.md) | `/inativarVeiculo` | Marcar o status do veículo como inativo. O veículo não será mais exibido ao clie |
| [veiculo](./veiculo.md) | `/informarVeiculoAdimplente` | Marcar o status do veículo como adimplente. |
| [veiculo](./veiculo.md) | `/informarVeiculoInadimplente` | Marcar o status do veículo como inadimplente. O veículo não será mais exibido ao |
| [veiculo](./veiculo.md) | `/obterStatusVeiculo` | Obter o status atual do veículo. |
| [veiculo](./veiculo.md) | `/obterDadosVeiculo` | Obter os dados do cadastro do veículo. |
| [operacional](./operacional.md) | `/obterUltimaPosicaoValida` | Obter a última posição válida do veículo. |
| [operacional](./operacional.md) | `/obterLinkCompartilhamento` | Obter um link de compartilhamento de posiçào válido por 24 horas |
| [operacional](./operacional.md) | `/acionamentoRouboFurto` | Criar um acionamento de Roubo ou Furto com possibilidade de entrar com informaçõ |
