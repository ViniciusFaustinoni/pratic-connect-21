import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.92c0c85d494b4393acfe0b1c2d58ec23',
  appName: 'pratic-connect-21',
  webDir: 'dist',
  server: {
    url: 'https://92c0c85d-494b-4393-acfe-0b1c2d58ec23.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    BackgroundGeolocation: {
      // Intervalo mínimo entre atualizações (milissegundos)
      locationUpdateInterval: 300000, // 5 minutos
      // Distância mínima para disparar atualização (metros)
      distanceFilter: 50,
    }
  }
};

export default config;
