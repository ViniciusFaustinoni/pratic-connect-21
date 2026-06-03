# SGA Hinova API v2 — Índice completo (136 endpoints)

Base URL: `https://api.hinova.com.br/api/sga/v2`

| Grupo | Método | URL | Título |
|---|---|---|---|
| [Associado](associado.md) | `POST` | `/alterar/associado` | Alterar |
| [Associado](associado.md) | `POST` | `/associado/cadastrar` | Cadastrar |
| [Associado](associado.md) | `GET` | `/associado/novos-contratos/listar` | Listar a quantidade de contratos |
| [Associado](associado.md) | `GET` | `associado-ativo-inativo/listar` | Quant. Associado Ativo/Inativo |
| [Associado](associado.md) | `GET` | `associado/alterar-situacao-para/:codigo_situacao/:codigo_associado` | Alterar situação |
| [Associado](associado.md) | `GET` | `associado/aniversariante` | Listar Aniversariante Dia |
| [Associado](associado.md) | `GET` | `associado/buscar-por-cpf-senha/:cpf/:senha` | Buscar Por CPF-CNPJ e Senha |
| [Associado](associado.md) | `GET` | `associado/buscar/:cpfOuCodigo/:buscar_por` | Buscar |
| [Associado](associado.md) | `GET` | `associado/cartao/listar/:codigoOuCpf` | Buscar Cartões associado |
| [Associado](associado.md) | `GET` | `associado/gerar-url-cadastro-cartao/:id_associado/:cpf` | Gerar URL Cadastro Cartão |
| [Associado](associado.md) | `POST` | `indicacao-externa/cadastrar` | Cadastrar Indicação Externa |
| [Associado](associado.md) | `GET` | `indicacao-externa/listar/:situacao` | Listar Indicação Ext. |
| [Associado](associado.md) | `POST` | `listar/alteracao-associados/` | Listar Alterações de Associados |
| [Associado](associado.md) | `POST` | `listar/associado/` | Listar |
| [Associado](associado.md) | `GET` | `listar/estadocivil/:situacao` | Listar Estados Civis |
| [Associado](associado.md) | `GET` | `listar/parentesco/:situacao` | Listar Parentescos |
| [Associado](associado.md) | `GET` | `listar/profissao/:situacao` | Listar Profissões |
| [Associado](associado.md) | `GET` | `listar/situacao/:situacao` | Listar Situação |
| [Associado](associado.md) | `GET` | `listar/vencimento/:situacao` | Listar Vencimentos |
| [Associado](associado.md) | `GET` | `midia/listar/:situacao` | Listar Mídia |
| [Atendimento](atendimento.md) | `POST` | `/cadastrar/historico-atendimento-associado` | Cadastrar Hist. Associado |
| [Atendimento](atendimento.md) | `GET` | `buscar/historico-atendimento-associado/:cpf` | Busca Hist. Associado |
| [Atendimento](atendimento.md) | `GET` | `listar/departamento/:situacao` | LIstar departamento |
| [Atendimento](atendimento.md) | `GET` | `listar/status-atendimento/:situacao` | Listar status |
| [Atendimento](atendimento.md) | `GET` | `listar/tipo-atendimento/:situacao` | Listar tipo |
| [Autenticacao](autenticacao.md) | `POST` | `/usuario/autenticar` | Autenticar Usuário |
| [Beneficiario](beneficiario.md) | `POST` | `/alterar/beneficiario` | Alterar |
| [Beneficiario](beneficiario.md) | `POST` | `/beneficiario/cadastrar` | Cadastrar |
| [Beneficiario](beneficiario.md) | `GET` | `alterar/beneficiario-para-associado/:codigo_ou_cpf` | Alterar para associado |
| [Beneficiario](beneficiario.md) | `POST` | `listar/beneficiario` | Listar |
| [Beneficiario](beneficiario.md) | `GET` | `listar/beneficio-beneficiario/:codigo_beneficiario` | Listar Benefícios Vinculados |
| [Beneficiario](beneficiario.md) | `GET` | `listar/conta/:situacao` | Listar contas bancárias |
| [Beneficiario](beneficiario.md) | `GET` | `listar/estadocivil/:situacao` | Listar Estado Civil |
| [Beneficiario](beneficiario.md) | `GET` | `listar/parentesco/:situacao` | Listar parentesco |
| [Beneficiario](beneficiario.md) | `GET` | `listar/profissao/:situacao` | Listar profissao |
| [Beneficiario](beneficiario.md) | `GET` | `listar/situacao/:situacao` | Listar situacao |
| [Beneficiario](beneficiario.md) | `GET` | `listar/vencimento/:situacao` | Listar vencimento |
| [Beneficio](beneficio.md) | `POST` | `/alterar/beneficio` | Alterar |
| [Beneficio](beneficio.md) | `POST` | `/beneficiario/vincular-beneficio` | Vincular |
| [Beneficio](beneficio.md) | `POST` | `/vincular-remover/beneficio` | Vincular ou remover benefício |
| [Beneficio](beneficio.md) | `GET` | `listar/beneficio-por-situacao/:situacao` | Listar |
| [Beneficio](beneficio.md) | `GET` | `listar/classificacao-beneficio/:situacao` | Listar Classificação |
| [Boleto](boleto.md) | `POST` | `/boleto/cadastrar` | Cadastrar |
| [Boleto](boleto.md) | `POST` | `/listar/boleto-associado-veiculo` | Listar por associado/veículo |
| [Boleto](boleto.md) | `POST` | `/listar/boleto-associado/periodo` | Listar por período |
| [Boleto](boleto.md) | `POST` | `alterar/vencimento-boleto` | Alterar Vencimento |
| [Boleto](boleto.md) | `GET` | `buscar/boleto/:nosso_numero` | Buscar |
| [Boleto](boleto.md) | `POST` | `listar/boleto` | Listar |
| [Boleto](boleto.md) | `POST` | `listar/boleto/periodo` | Listar Boleto Associado Beneficiario |
| [Boleto](boleto.md) | `GET` | `listar/conta/:situacao` | Listar Contas Bancárias |
| [Boleto](boleto.md) | `GET` | `listar/situacao-boleto/:situacao` | Listar Situação |
| [Boleto](boleto.md) | `GET` | `listar/tipo-boleto/:situacao` | Listar tipo |
| [Boleto](boleto.md) | `GET` | `tipo-cobranca-recorrente/listar/:situacao` | Listar Tipo Cobr. Recorrente |
| [Boleto](boleto.md) | `GET` | `tipo-envio-boleto/listar/:situacao` | Listar tipo do envio do boleto |
| [Cooperativa](cooperativa.md) | `POST` | `/cooperativa/cadastrar` | Cadastrar |
| [Cooperativa](cooperativa.md) | `GET` | `cooperativa/buscar/:codigo_cooperativa` | Buscar |
| [Cooperativa](cooperativa.md) | `GET` | `listar/cooperativa/:situacao` | Listar |
| [Cota](cota.md) | `GET` | `cota/buscar/:codigo_cota` | Buscar |
| [Cota](cota.md) | `GET` | `listar/cota/:codigo_regional/:codigo_cooperativa/:codigo_tipo_veiculo/:valor_fipe/:cilindrada` | Listar |
| [Evento](evento.md) | `POST` | `evento-aberto/listar` | Listar Eventos Abertos |
| [Evento](evento.md) | `POST` | `evento-finalizado/listar` | Listar Eventos Finalizados |
| [Evento](evento.md) | `GET` | `evento-sem-alteracao/listar/:quantidade_dias/:codigo_situacao` | Listar Eventos Sem Alteração |
| [Evento](evento.md) | `GET` | `listar/evento-veiculo/:placa_ou_codigo` | Listar por veículo |
| [Evento](evento.md) | `GET` | `situacao-evento/listar/:situacao` | Listar Situações Evento |
| [Evento](evento.md) | `GET` | `veiculo-reparo-oficina/listar` | Veículos por Oficina/Fornecedor |
| [Fornecedor](fornecedor.md) | `GET` | `fornecedor/buscar/:cpf_cnpj` | Buscar |
| [Fornecedor](fornecedor.md) | `POST` | `fornecedor/cadastrar` | Cadastrar |
| [MGF](mgf.md) | `GET` | `listar/conta/:situacao` | Listar conta bancária |
| [MGF](mgf.md) | `GET` | `mgf-caixa/listar/:situacao` |  |
| [MGF](mgf.md) | `GET` | `mgf-conta-pagar/buscar/:codigo_ou_nota` | Buscar Conta Pagar |
| [MGF](mgf.md) | `GET` | `mgf-conta-receber/buscar/:codigo_ou_nota` | Buscar Conta Receber |
| [MGF](mgf.md) | `POST` | `mgf-lancamento/alterar` | Alterar Lançamento |
| [MGF](mgf.md) | `POST` | `mgf-lancamento/cadastrar` | Cadastrar Lançamento |
| [MGF](mgf.md) | `GET` | `mgf-lancamento/excluir/:codigo_lancamento` | Excluir Lançamento |
| [MGF](mgf.md) | `POST` | `mgf-lancamento/listar` | Listar Lançamento |
| [MGF](mgf.md) | `GET` | `mgf-operacao/listar` | Listar Operações MGF |
| [MGF](mgf.md) | `GET` | `mgf-saldo-caixa/buscar/:codigo_caixa` | Buscar Saldo Caixa |
| [MGF](mgf.md) | `GET` | `mgf-saldo-conta/buscar/:codigo_conta` | Buscar Saldo Conta |
| [MGF](mgf.md) | `GET` | `mgf-suboperacao/listar/:situacao` | Listar Sub-operação |
| [Produto](produto.md) | `POST` | `/veiculo/incluir/produto-adicional` | Cadastrar Prod. Adicional |
| [Produto](produto.md) | `POST` | `/veiculo/listar-produto-adicional` | Listar Prod. Adicional |
| [Produto](produto.md) | `GET` | `grupoproduto/listar` | Listar Grupo Produto |
| [Produto](produto.md) | `GET` | `listar/classificacao-produto/:situacao` | Listar Classificação |
| [Produto](produto.md) | `GET` | `listar/grupo-produto/:situacao` | Listar grupo |
| [Produto](produto.md) | `GET` | `listar/produto-por-situacao/:situacao` | Listar Por Situação |
| [Produto](produto.md) | `GET` | `listar/produto/:codigo_regional/:codigo_cooperativa/:codigo_tipo_veiculo/:valor_fipe/:cilindrada` | Listar |
| [Produto](produto.md) | `GET` | `produto-vinculado-veiculo/listar/:codigoOuPlaca` | Listar Produtos Veículo |
| [Produto](produto.md) | `GET` | `produto/buscar/:codigo_produto` | Buscar |
| [Produto](produto.md) | `POST` | `veiculo/vincular-remover/produto` | Vincular ou remover produto |
| [Regional](regional.md) | `POST` | `/regional/cadastrar/` | Cadastrar |
| [Regional](regional.md) | `GET` | `listar/regional/:situacao` | Listar |
| [Veiculo](veiculo.md) | `POST` | `/alterar/veiculo` | Alterar |
| [Veiculo](veiculo.md) | `POST` | `/buscar/rateio-medio` | Buscar rateio |
| [Veiculo](veiculo.md) | `GET` | `/buscar/situacao-financeira-veiculo/:codigo_ou_placa` | Buscar situação Financeira |
| [Veiculo](veiculo.md) | `POST` | `/cadastrar/agregado` | Cadastrar Agregado |
| [Veiculo](veiculo.md) | `GET` | `/implemento-vinculado/listar/:codigoOuPlaca` | Listar Implementos Vinculados |
| [Veiculo](veiculo.md) | `POST` | `/listar/alteracao-veiculos` | Listar Alterações de Veículos |
| [Veiculo](veiculo.md) | `GET` | `/listar/categoria-veiculo/:codigo_tipo/:situacao` | Listar categoria |
| [Veiculo](veiculo.md) | `GET` | `/listar/combustivel/:situacao` | Listar combustível |
| [Veiculo](veiculo.md) | `GET` | `/listar/cor/:situacao` | Listar cor |
| [Veiculo](veiculo.md) | `GET` | `/listar/depreciacao/:situacao` | Listar Depreciação |
| [Veiculo](veiculo.md) | `GET` | `/listar/implemento/:situacao` | Listar Implementos |
| [Veiculo](veiculo.md) | `GET` | `/listar/marca/:situacao` | Listar marca |
| [Veiculo](veiculo.md) | `GET` | `/listar/tipo-veiculo/:situacao` | Listar tipo |
| [Veiculo](veiculo.md) | `POST` | `/modelo/listar` | Listar Modelos |
| [Veiculo](veiculo.md) | `GET` | `/veiculo/buscar/:placaOuChassi` | Buscar |
| [Veiculo](veiculo.md) | `POST` | `/veiculo/cadastrar` | Cadastrar |
| [Veiculo](veiculo.md) | `POST` | `/veiculo/foto/cadastrar` | Cadastrar foto |
| [Veiculo](veiculo.md) | `POST` | `/veiculo/produto/remover` | Remover produto |
| [Veiculo](veiculo.md) | `POST` | `/veiculo/vincular/produto` | Vincular produto |
| [Veiculo](veiculo.md) | `POST` | `/vincular/implemento` | Vincular implemento |
| [Veiculo](veiculo.md) | `GET` | `buscar/situacao-veiculo/:placaOuChassi` | Buscar situação veículo |
| [Veiculo](veiculo.md) | `GET` | `listar/alienacao/:situacao` | Listar Alienação |
| [Veiculo](veiculo.md) | `GET` | `listar/conta/:situacao` | Listar conta bancária |
| [Veiculo](veiculo.md) | `GET` | `listar/forma-pagamento/:situacao` | Listar Forma Pag. |
| [Veiculo](veiculo.md) | `GET` | `listar/situacao/:situacao` | Listar situação |
| [Veiculo](veiculo.md) | `POST` | `listar/veiculo` | Listar |
| [Veiculo](veiculo.md) | `GET` | `produto-adicional/remover/:codigo_veiculo/:codigo_produto_adicional` | Remover Prod. Adicional |
| [Veiculo](veiculo.md) | `GET` | `tipo-adesao/listar/:situacao` | Listar Tipo Adesão |
| [Veiculo](veiculo.md) | `GET` | `veiculo/alterar-situacao-para/:codigo_situacao/:codigo_veiculo` | Alterar situação |
| [Veiculo](veiculo.md) | `GET` | `veiculo/listar-veiculo-produto/:codigo_situacao` | Lista prod. vinculado |
| [Vistoria](vistoria.md) | `POST` | `/cadastrar/vistoria` | Cadastrar vistoria |
| [Vistoria](vistoria.md) | `GET` | `listar/estado-pneu/:situacao` | Listar tipo pneu |
| [Vistoria](vistoria.md) | `GET` | `listar/tipo-foto/:situacao` | Listar tipo foto |
| [Vistoria](vistoria.md) | `GET` | `listar/tipo-vistoria/:situacao` | Listar Tipo Vistoria. |
| [Vistoria](vistoria.md) | `GET` | `listar/vistoriador/:situacao` | Listar Vistoriador |
| [Voluntario](voluntario.md) | `POST` | `/listar/indicacao/` | Listar indicações |
| [Voluntario](voluntario.md) | `POST` | `/listar/placas-por-voluntario/` | Listar placas |
| [Voluntario](voluntario.md) | `POST` | `/voluntario/cadastrar` | Cadastrar |
| [Voluntario](voluntario.md) | `POST` | `/voluntario/cadastrar-cooperativa/` | Vincular à cooperativa |
| [Voluntario](voluntario.md) | `POST` | `/voluntario/excluir-cooperativa/` | Remover de cooperativa |
| [Voluntario](voluntario.md) | `GET` | `buscar/voluntario/:cpdOuCodigo` | Buscar |
| [Voluntario](voluntario.md) | `POST` | `listar/alteracao-voluntario/` | Listar Alterações de Voluntários |
| [Voluntario](voluntario.md) | `GET` | `listar/situacao-adesao-voluntario/:codigo_voluntario` | Listar situação adesão |
| [Voluntario](voluntario.md) | `POST` | `listar/voluntario-por-data-cadastro` | Listar voluntário por data cadastro |
| [Voluntario](voluntario.md) | `GET` | `listar/voluntario/:situacao` | Listar |