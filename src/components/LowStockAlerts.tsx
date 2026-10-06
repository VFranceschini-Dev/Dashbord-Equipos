import { useApp } from '../context/AppContext';
import { getLowStockGroups, generateLowStockAlertMessage } from '../utils/tonerCompatibility';
import { AlertTriangle, Package, Bell } from 'lucide-react';

export default function LowStockAlerts() {
  const { toners } = useApp();
  const lowStockGroups = getLowStockGroups(toners);

  if (lowStockGroups.length === 0) {
    return null;
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="text-amber-600" size={20} />
        <h3 className="font-semibold text-amber-900">
          Alertas de Stock Bajo ({lowStockGroups.length})
        </h3>
      </div>
      
      <div className="space-y-2">
        {lowStockGroups.map((group, index) => {
          const colorLabel = group.key.color === 'black' ? 'Negro' :
                           group.key.color === 'cyan' ? 'Cian' :
                           group.key.color === 'magenta' ? 'Magenta' : 'Amarillo';
          
          return (
            <div key={index} className="bg-white border border-amber-200 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Package size={16} className="text-amber-600" />
                    <span className="font-semibold text-gray-900">
                      {group.key.brand} {group.key.model}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                      {colorLabel}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 ml-6">
                    <div className="flex items-center gap-4">
                      <span>
                        Stock total: <strong className="text-amber-700">{group.totalStock}</strong>
                      </span>
                      <span>
                        Mínimo: <strong>{group.minStock}</strong>
                      </span>
                      <span>
                        Máximo: <strong>{group.maxStock}</strong>
                      </span>
                    </div>
                    
                    <div className="mt-1 text-xs text-gray-500">
                      Proveedores: {group.suppliers.join(', ')}
                    </div>
                    
                    <div className="mt-1 text-xs text-gray-500">
                      {group.toners.length} registro{group.toners.length !== 1 ? 's' : ''} de tóner compatible
                    </div>
                  </div>
                </div>
                
                <div className="ml-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Precio promedio</div>
                    <div className="font-semibold text-gray-900">
                      ${group.avgPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-3 text-xs text-amber-700 bg-amber-100 rounded-lg p-2">
        <Bell size={12} className="inline mr-1" />
        Las alertas se calculan sumando el stock de todos los tóneres compatibles (misma marca, modelo y color) de diferentes proveedores.
      </div>
    </div>
  );
}
