import { useState } from 'react';
import { CheckCircle, XCircle, Edit, Save, X, Car } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PermissionGate } from '@/components/PermissionGate';

interface DadosCliente {
  nome: string;
  telefone: string;
  email: string;
  cpf: string;
}

interface DadosVeiculo {
  marca: string;
  modelo: string;
  ano: number;
  placa: string;
  valor_fipe: number;
}

interface CotacaoValidacaoProps {
  cotacao: {
    id: string;
    validado?: boolean;
    lead?: {
      nome: string;
      telefone: string;
      email?: string;
      cpf?: string;
    };
    veiculo_marca: string;
    veiculo_modelo: string;
    veiculo_ano: number;
    veiculo_placa?: string;
    valor_fipe: number;
  };
  onValidar?: (aprovado: boolean, observacao: string) => void;
  onUpdateClientData?: (dados: DadosCliente) => void;
  onUpdateVehicleData?: (dados: DadosVeiculo) => void;
}

export function CotacaoValidacao({
  cotacao,
  onValidar,
  onUpdateClientData,
  onUpdateVehicleData,
}: CotacaoValidacaoProps) {
  const [editandoCliente, setEditandoCliente] = useState(false);
  const [editandoVeiculo, setEditandoVeiculo] = useState(false);
  const [observacao, setObservacao] = useState('');
  
  const [clienteData, setClienteData] = useState<DadosCliente>({
    nome: cotacao.lead?.nome || '',
    telefone: cotacao.lead?.telefone || '',
    email: cotacao.lead?.email || '',
    cpf: cotacao.lead?.cpf || '',
  });

  const [veiculoData, setVeiculoData] = useState<DadosVeiculo>({
    marca: cotacao.veiculo_marca || '',
    modelo: cotacao.veiculo_modelo || '',
    ano: cotacao.veiculo_ano || 0,
    placa: cotacao.veiculo_placa || '',
    valor_fipe: cotacao.valor_fipe || 0,
  });

  const handleSalvarCliente = () => {
    onUpdateClientData?.(clienteData);
    setEditandoCliente(false);
  };

  const handleSalvarVeiculo = () => {
    onUpdateVehicleData?.(veiculoData);
    setEditandoVeiculo(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Painel de Validação</CardTitle>
        <Badge variant={cotacao.validado ? 'default' : 'secondary'}>
          {cotacao.validado ? 'Validado' : 'Pendente'}
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {!cotacao.validado && (
          <Alert>
            <AlertDescription>
              Atenção: Revise os dados do cliente e veículo antes de validar.
            </AlertDescription>
          </Alert>
        )}
        
        {/* Seção: Dados do Cliente */}
        <PermissionGate permission="cotacao.canEditClientData">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Dados do Cliente</h3>
              {!editandoCliente ? (
                <Button variant="ghost" size="sm" onClick={() => setEditandoCliente(true)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={handleSalvarCliente}>
                    <Save className="h-4 w-4 mr-1" />
                    Salvar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditandoCliente(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            
            {editandoCliente ? (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Nome"
                  value={clienteData.nome}
                  onChange={(e) => setClienteData({ ...clienteData, nome: e.target.value })}
                />
                <Input
                  placeholder="CPF"
                  value={clienteData.cpf}
                  onChange={(e) => setClienteData({ ...clienteData, cpf: e.target.value })}
                />
                <Input
                  placeholder="Telefone"
                  value={clienteData.telefone}
                  onChange={(e) => setClienteData({ ...clienteData, telefone: e.target.value })}
                />
                <Input
                  placeholder="Email"
                  value={clienteData.email}
                  onChange={(e) => setClienteData({ ...clienteData, email: e.target.value })}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p><span className="text-muted-foreground">Nome:</span> {cotacao.lead?.nome}</p>
                <p><span className="text-muted-foreground">CPF:</span> {cotacao.lead?.cpf || '—'}</p>
                <p><span className="text-muted-foreground">Telefone:</span> {cotacao.lead?.telefone}</p>
                <p><span className="text-muted-foreground">Email:</span> {cotacao.lead?.email || '—'}</p>
              </div>
            )}
          </div>
        </PermissionGate>
        
        {/* Seção: Dados do Veículo */}
        <PermissionGate permission="cotacao.canEditVehicleData">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Car className="h-4 w-4" />
                Dados do Veículo
              </h3>
              {!editandoVeiculo ? (
                <Button variant="ghost" size="sm" onClick={() => setEditandoVeiculo(true)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={handleSalvarVeiculo}>
                    <Save className="h-4 w-4 mr-1" />
                    Salvar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditandoVeiculo(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            
            {editandoVeiculo ? (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Marca"
                  value={veiculoData.marca}
                  onChange={(e) => setVeiculoData({ ...veiculoData, marca: e.target.value })}
                />
                <Input
                  placeholder="Modelo"
                  value={veiculoData.modelo}
                  onChange={(e) => setVeiculoData({ ...veiculoData, modelo: e.target.value })}
                />
                <Input
                  placeholder="Ano"
                  type="number"
                  value={veiculoData.ano}
                  onChange={(e) => setVeiculoData({ ...veiculoData, ano: parseInt(e.target.value) || 0 })}
                />
                <Input
                  placeholder="Placa"
                  value={veiculoData.placa}
                  onChange={(e) => setVeiculoData({ ...veiculoData, placa: e.target.value })}
                />
                <Input
                  placeholder="Valor FIPE"
                  type="number"
                  value={veiculoData.valor_fipe}
                  onChange={(e) => setVeiculoData({ ...veiculoData, valor_fipe: parseFloat(e.target.value) || 0 })}
                  className="col-span-2"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p><span className="text-muted-foreground">Marca:</span> {cotacao.veiculo_marca}</p>
                <p><span className="text-muted-foreground">Modelo:</span> {cotacao.veiculo_modelo}</p>
                <p><span className="text-muted-foreground">Ano:</span> {cotacao.veiculo_ano}</p>
                <p><span className="text-muted-foreground">Placa:</span> {cotacao.veiculo_placa || '—'}</p>
                <p className="col-span-2">
                  <span className="text-muted-foreground">Valor FIPE:</span> {formatCurrency(cotacao.valor_fipe)}
                </p>
              </div>
            )}
          </div>
        </PermissionGate>
        
        {/* Área de validação */}
        <PermissionGate permission="cotacao.canValidate">
          {!cotacao.validado && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Validação</h3>
              <Textarea
                placeholder="Observações sobre a validação..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2 mt-4">
                <Button 
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => onValidar?.(true, observacao)}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Aprovar
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => onValidar?.(false, observacao)}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reprovar
                </Button>
              </div>
            </div>
          )}
        </PermissionGate>
      </CardContent>
    </Card>
  );
}
