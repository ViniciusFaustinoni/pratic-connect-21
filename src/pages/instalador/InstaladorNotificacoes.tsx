import { ArrowLeft, Bell, CheckCircle, Zap, Package, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Notificações mock - em produção, buscar do banco
const notificacoesMock = [
  {
    id: '1',
    tipo: 'tarefa',
    titulo: 'Nova tarefa atribuída',
    descricao: 'Instalação - ABC-1234',
    data: new Date(),
    lida: false,
  },
  {
    id: '2',
    tipo: 'encaixe',
    titulo: 'Encaixe urgente disponível',
    descricao: 'Cliente reagendou para hoje',
    data: new Date(Date.now() - 1000 * 60 * 60),
    lida: false,
  },
  {
    id: '3',
    tipo: 'concluida',
    titulo: 'Tarefa concluída',
    descricao: 'Vistoria - XYZ-5678',
    data: new Date(Date.now() - 1000 * 60 * 60 * 24),
    lida: true,
  },
];

const getIconByTipo = (tipo: string) => {
  switch (tipo) {
    case 'tarefa':
      return <CheckCircle className="h-5 w-5 text-blue-400" />;
    case 'encaixe':
      return <Zap className="h-5 w-5 text-amber-400" />;
    case 'concluida':
      return <Package className="h-5 w-5 text-green-400" />;
    default:
      return <Bell className="h-5 w-5 text-slate-400" />;
  }
};

const formatarData = (data: Date) => {
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  
  if (data.toDateString() === hoje.toDateString()) {
    return format(data, 'HH:mm');
  }
  if (data.toDateString() === ontem.toDateString()) {
    return 'Ontem';
  }
  return format(data, 'dd/MM');
};

const agruparPorDia = (notificacoes: typeof notificacoesMock) => {
  const grupos: { [key: string]: typeof notificacoesMock } = {};
  const hoje = new Date().toDateString();
  const ontem = new Date(Date.now() - 1000 * 60 * 60 * 24).toDateString();
  
  notificacoes.forEach(notif => {
    const dataStr = notif.data.toDateString();
    let label = format(notif.data, "dd 'de' MMMM", { locale: ptBR });
    
    if (dataStr === hoje) label = 'Hoje';
    else if (dataStr === ontem) label = 'Ontem';
    
    if (!grupos[label]) grupos[label] = [];
    grupos[label].push(notif);
  });
  
  return grupos;
};

export default function InstaladorNotificacoes() {
  const navigate = useNavigate();
  const grupos = agruparPorDia(notificacoesMock);

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-slate-400 hover:text-white"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-400" />
            Notificações
          </h1>
        </div>

        {/* Lista de Notificações agrupadas por dia */}
        {Object.keys(grupos).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="h-12 w-12 text-slate-600 mb-3" />
            <p className="text-slate-400">Nenhuma notificação</p>
          </div>
        ) : (
          Object.entries(grupos).map(([label, notifs]) => (
            <div key={label} className="space-y-2">
              <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide px-1">
                {label}
              </h2>
              {notifs.map(notif => (
                <Card 
                  key={notif.id} 
                  className={`border-slate-700 bg-slate-800 ${!notif.lida ? 'border-l-2 border-l-blue-500' : ''}`}
                >
                  <CardContent className="p-3 flex items-start gap-3">
                    <div className="mt-0.5">
                      {getIconByTipo(notif.tipo)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">
                        {notif.titulo}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {notif.descricao}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      {formatarData(notif.data)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
