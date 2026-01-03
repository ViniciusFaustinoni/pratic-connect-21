import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Receipt, 
  MapPin, 
  Phone, 
  MessageSquare, 
  AlertTriangle, 
  Car, 
  ChevronRight 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

// Mock data
const mockAssociado = {
  nome: 'João',
  plano: 'Completo',
  status: 'ativo',
  veiculos: [
    { id: '1', placa: 'ABC-1234', modelo: 'VW Gol 2020', cor: 'Prata' },
    { id: '2', placa: 'XYZ-9876', modelo: 'Fiat Mobi 2021', cor: 'Branco' },
  ],
  proximoBoleto: {
    vencimento: '2026-02-10',
    valor: 199.90,
    diasParaVencer: 3,
  },
  alertas: [
    { id: '1', tipo: 'boleto', mensagem: 'Boleto vence em 3 dias' },
  ],
};

export default function AppHome() {
  const navigate = useNavigate();
  const [veiculoSelecionado, setVeiculoSelecionado] = useState(mockAssociado.veiculos[0]);

  const formatarData = (dataStr: string) => {
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const handleWhatsApp = () => {
    window.open('https://wa.me/5511999999999', '_blank');
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Saudação */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Olá, {mockAssociado.nome}! 👋
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">{mockAssociado.plano}</span>
            <span className="text-muted-foreground">•</span>
            <Badge variant="default" className="bg-green-600 hover:bg-green-600">
              {mockAssociado.status === 'ativo' ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Card Veículo Atual */}
      <Card className="border-blue-200 bg-blue-50 mt-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Car className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-mono text-2xl font-bold text-foreground">
                {veiculoSelecionado.placa}
              </p>
              <p className="text-sm text-muted-foreground">
                {veiculoSelecionado.modelo} • {veiculoSelecionado.cor}
              </p>
            </div>
          </div>
          
          {mockAssociado.veiculos.length > 1 && (
            <div className="mt-4">
              <Select
                value={veiculoSelecionado.id}
                onValueChange={(value) => {
                  const veiculo = mockAssociado.veiculos.find(v => v.id === value);
                  if (veiculo) setVeiculoSelecionado(veiculo);
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Trocar veículo" />
                </SelectTrigger>
                <SelectContent>
                  {mockAssociado.veiculos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.placa} - {v.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid de Atalhos */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        {/* Próximo Boleto */}
        <Card 
          className="cursor-pointer border shadow-sm transition-shadow hover:shadow-md"
          onClick={() => navigate('/app/boletos')}
        >
          <CardContent className="flex flex-col items-center p-4 text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
              <Receipt className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Próximo boleto</p>
            <p className="text-sm text-muted-foreground">
              {formatarData(mockAssociado.proximoBoleto.vencimento)}
            </p>
            <p className="text-lg font-bold text-foreground">
              R$ {mockAssociado.proximoBoleto.valor.toFixed(2).replace('.', ',')}
            </p>
          </CardContent>
        </Card>

        {/* Rastrear */}
        <Card 
          className="cursor-pointer border shadow-sm transition-shadow hover:shadow-md"
          onClick={() => navigate('/app/rastreamento')}
        >
          <CardContent className="flex flex-col items-center p-4 text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
              <MapPin className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-foreground">Rastrear agora</p>
            <p className="text-sm text-muted-foreground">Ver localização</p>
          </CardContent>
        </Card>

        {/* Assistência 24h */}
        <Card 
          className="cursor-pointer border border-red-100 bg-red-50 shadow-sm transition-shadow hover:shadow-md"
          onClick={() => navigate('/app/assistencia')}
        >
          <CardContent className="flex flex-col items-center p-4 text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <Phone className="h-6 w-6 text-red-600" />
            </div>
            <p className="text-sm font-medium text-foreground">Assistência 24h</p>
            <p className="text-sm text-muted-foreground">Guincho, pane, etc</p>
          </CardContent>
        </Card>

        {/* Fale Conosco */}
        <Card 
          className="cursor-pointer border shadow-sm transition-shadow hover:shadow-md"
          onClick={handleWhatsApp}
        >
          <CardContent className="flex flex-col items-center p-4 text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-purple-50">
              <MessageSquare className="h-6 w-6 text-purple-600" />
            </div>
            <p className="text-sm font-medium text-foreground">Fale conosco</p>
            <p className="text-sm text-muted-foreground">WhatsApp</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {mockAssociado.alertas.length > 0 && (
        <div className="mt-6 space-y-2">
          {mockAssociado.alertas.map((alerta) => (
            <div
              key={alerta.id}
              className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4"
            >
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
              <p className="flex-1 text-sm text-yellow-800">{alerta.mensagem}</p>
              <Button 
                variant="ghost" 
                size="sm"
                className="text-yellow-700 hover:bg-yellow-100"
                onClick={() => navigate('/app/boletos')}
              >
                Ver
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Seção Meus Veículos */}
      <div className="mt-6">
        <h2 className="mb-3 font-semibold text-foreground">Meus Veículos</h2>
        <div className="space-y-2">
          {mockAssociado.veiculos.map((veiculo, index) => (
            <Card key={veiculo.id} className="border shadow-sm">
              <CardContent className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <Car className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-mono font-medium text-foreground">{veiculo.placa}</p>
                    <p className="text-sm text-muted-foreground">{veiculo.modelo}</p>
                  </div>
                </div>
                {index === 0 && (
                  <Badge variant="secondary">Principal</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
