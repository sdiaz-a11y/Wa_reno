import { CheckCircle, XCircle, Clock } from 'phosphor-react';

const ESTADO_ICON = {
  enviado: { icon: CheckCircle, color: 'text-emerald-glow' },
  fallido: { icon: XCircle, color: 'text-red-400' },
  pendiente: { icon: Clock, color: 'text-amber-400' },
};

export default function HistorialEnvios({ campanas }) {
  if (campanas.length === 0) {
    return <p className="text-sm text-white/30">No hay campañas completadas todavía.</p>;
  }

  return (
    <div className="space-y-4">
      {campanas.map((c) => (
        <div key={c.id} className="glass-shell animate-fade-up">
          <div className="glass-core p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white/80">{c.nombrePlantilla || 'Plantilla'}</p>
                <p className="text-xs text-white/30">
                  {c.ejecutadoEn?.toDate?.().toLocaleString('es-MX') || c.fechaProgramada?.toDate?.().toLocaleString('es-MX')}
                </p>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] uppercase tracking-wider text-white/50">
                {c.estado}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {['enviados', 'fallidos', 'pendientes'].map((key) => {
                const { icon: Icon, color } = ESTADO_ICON[key === 'enviados' ? 'enviado' : key === 'fallidos' ? 'fallido' : 'pendiente'];
                return (
                  <div key={key} className="rounded-2xl border border-white/5 bg-white/[0.02] p-3 text-center">
                    <Icon size={16} weight="light" className={`mx-auto mb-1 ${color}`} />
                    <p className="text-lg font-semibold text-white">{c.resultados?.[key] || 0}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/30">{key}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
