import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Upload, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const tiposSinistro = [
  { value: 'roubo', label: 'Roubo' },
  { value: 'furto', label: 'Furto' },
  { value: 'colisao', label: 'Colisão' },
  { value: 'incendio', label: 'Incêndio' },
  { value: 'alagamento', label: 'Alagamento' },
  { value: 'outro', label: 'Outro' },
];

export default function AppSinistroNovo() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tipo: '',
    dataOcorrencia: '',
    horaOcorrencia: '',
    local: '',
    descricao: '',
    boNumero: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.tipo || !formData.dataOcorrencia || !formData.local) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast.success('Sinistro registrado com sucesso!');
    navigate('/app/sinistros');
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Novo Sinistro</h1>
          <p className="text-sm text-muted-foreground">Registre uma ocorrência</p>
        </div>
      </div>

      {/* Warning */}
      <Card className="border-0 bg-amber-50 shadow-sm">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Atenção</p>
            <p>Para roubo ou furto, é obrigatório anexar o Boletim de Ocorrência.</p>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Informações da Ocorrência</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Sinistro *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tiposSinistro.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="data">Data *</Label>
                <Input
                  id="data"
                  type="date"
                  value={formData.dataOcorrencia}
                  onChange={(e) => setFormData({ ...formData, dataOcorrencia: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hora">Hora</Label>
                <Input
                  id="hora"
                  type="time"
                  value={formData.horaOcorrencia}
                  onChange={(e) => setFormData({ ...formData, horaOcorrencia: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="local">Local da Ocorrência *</Label>
              <Input
                id="local"
                placeholder="Endereço ou descrição do local"
                value={formData.local}
                onChange={(e) => setFormData({ ...formData, local: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                placeholder="Descreva o que aconteceu..."
                rows={4}
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              />
            </div>

            {(formData.tipo === 'roubo' || formData.tipo === 'furto') && (
              <div className="space-y-2">
                <Label htmlFor="bo">Número do B.O. *</Label>
                <Input
                  id="bo"
                  placeholder="Ex: 123456/2026"
                  value={formData.boNumero}
                  onChange={(e) => setFormData({ ...formData, boNumero: e.target.value })}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Documentos</CardTitle>
          </CardHeader>
          <CardContent>
            <button
              type="button"
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Upload className="h-8 w-8" />
              <span className="text-sm font-medium">Anexar documentos</span>
              <span className="text-xs">B.O., fotos, etc.</span>
            </button>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Enviando...' : 'Registrar Sinistro'}
        </Button>
      </form>
    </div>
  );
}
