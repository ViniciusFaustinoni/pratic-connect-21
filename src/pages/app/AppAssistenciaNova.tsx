import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';

const serviceTypes = [
  { id: 'guincho', label: 'Guincho', description: 'Remoção do veículo' },
  { id: 'chaveiro', label: 'Chaveiro', description: 'Abertura ou cópia de chave' },
  { id: 'pane_seca', label: 'Pane Seca', description: 'Falta de combustível' },
  { id: 'pane_eletrica', label: 'Pane Elétrica', description: 'Problema na bateria' },
  { id: 'troca_pneu', label: 'Troca de Pneu', description: 'Pneu furado ou danificado' },
  { id: 'outro', label: 'Outro', description: 'Outro tipo de assistência' },
];

export default function AppAssistenciaNova() {
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const handleGetLocation = () => {
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsGettingLocation(false);
        toast.success('Localização obtida com sucesso!');
      },
      () => {
        setIsGettingLocation(false);
        toast.error('Não foi possível obter sua localização');
      }
    );
  };

  const handleSubmit = async () => {
    if (!selectedService) {
      toast.error('Selecione o tipo de serviço');
      return;
    }

    setIsLoading(true);
    // TODO: Implement actual submission
    setTimeout(() => {
      setIsLoading(false);
      toast.success('Chamado aberto com sucesso!');
      navigate('/app/assistencia');
    }, 1500);
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">Nova Assistência</h1>
      </div>

      <div className="space-y-4">
        {/* Service Type */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tipo de Serviço</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={selectedService} onValueChange={setSelectedService}>
              <div className="space-y-3">
                {serviceTypes.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center space-x-3 rounded-lg border p-3"
                  >
                    <RadioGroupItem value={service.id} id={service.id} />
                    <Label htmlFor={service.id} className="flex-1 cursor-pointer">
                      <span className="font-medium">{service.label}</span>
                      <p className="text-xs text-muted-foreground">{service.description}</p>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Location */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Localização</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full min-h-[44px]"
              onClick={handleGetLocation}
              disabled={isGettingLocation}
            >
              {isGettingLocation ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="mr-2 h-4 w-4" />
              )}
              {location ? 'Localização obtida ✓' : 'Obter minha localização'}
            </Button>
            {location && (
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Description */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Descrição (opcional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Descreva o problema ou informações adicionais..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          className="w-full min-h-[44px]"
          onClick={handleSubmit}
          disabled={isLoading || !selectedService}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Solicitar Assistência
        </Button>
      </div>
    </div>
  );
}