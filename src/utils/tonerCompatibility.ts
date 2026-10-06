import { TonerItem } from '../types';

/**
 * Clave de compatibilidad para agrupar tóneres
 * Dos tóneres son compatibles si tienen la misma marca, modelo y color
 */
export interface TonerCompatibilityKey {
  brand: string;
  model: string;
  color: string;
}

/**
 * Grupo de tóneres compatibles con su stock total
 */
export interface TonerCompatibilityGroup {
  key: TonerCompatibilityKey;
  toners: TonerItem[];
  totalStock: number;
  minStock: number;
  maxStock: number;
  avgPrice: number;
  suppliers: string[];
}

/**
 * Genera una clave única de compatibilidad para un tóner
 */
export function getCompatibilityKey(toner: TonerItem): string {
  return `${toner.brand}|${toner.model}|${toner.color}`;
}

/**
 * Agrupa tóneres por compatibilidad (marca + modelo + color)
 * y calcula el stock total de cada grupo
 */
export function groupTonersByCompatibility(toners: TonerItem[]): TonerCompatibilityGroup[] {
  const groups = new Map<string, TonerCompatibilityGroup>();

  toners.forEach(toner => {
    const key = getCompatibilityKey(toner);
    
    if (!groups.has(key)) {
      groups.set(key, {
        key: {
          brand: toner.brand,
          model: toner.model,
          color: toner.color,
        },
        toners: [],
        totalStock: 0,
        minStock: toner.minStock,
        maxStock: toner.maxStock,
        avgPrice: 0,
        suppliers: [],
      });
    }

    const group = groups.get(key)!;
    group.toners.push(toner);
    group.totalStock += toner.stock;
    group.suppliers.push(toner.supplier);
    
    // Usar el minStock y maxStock del primer tóner del grupo
    // (asumimos que todos los tóneres compatibles tienen los mismos límites)
  });

  // Calcular precio promedio ponderado por stock
  groups.forEach(group => {
    const totalValue = group.toners.reduce((sum, t) => sum + (t.stock * t.unitPrice), 0);
    group.avgPrice = group.totalStock > 0 ? totalValue / group.totalStock : 0;
  });

  return Array.from(groups.values());
}

/**
 * Obtiene los grupos de tóneres con stock bajo
 * Un grupo tiene stock bajo si su stock total es menor o igual al minStock
 */
export function getLowStockGroups(toners: TonerItem[]): TonerCompatibilityGroup[] {
  const groups = groupTonersByCompatibility(toners);
  return groups.filter(group => group.totalStock <= group.minStock);
}

/**
 * Verifica si un tóner específico pertenece a un grupo con stock bajo
 */
export function isTonerInLowStockGroup(toner: TonerItem, allToners: TonerItem[]): boolean {
  const groups = getLowStockGroups(allToners);
  const tonerKey = getCompatibilityKey(toner);
  
  return groups.some(group => getCompatibilityKey(group.toners[0]) === tonerKey);
}

/**
 * Calcula el stock total de un grupo de compatibilidad específico
 */
export function getCompatibilityGroupStock(
  brand: string, 
  model: string, 
  color: string, 
  allToners: TonerItem[]
): number {
  const compatibleToners = allToners.filter(
    t => t.brand === brand && t.model === model && t.color === color
  );
  
  return compatibleToners.reduce((sum, t) => sum + t.stock, 0);
}

/**
 * Obtiene todos los tóneres compatibles con uno específico
 */
export function getCompatibleToners(toner: TonerItem, allToners: TonerItem[]): TonerItem[] {
  return allToners.filter(
    t => t.brand === toner.brand && 
         t.model === toner.model && 
         t.color === toner.color
  );
}

/**
 * Genera un mensaje de alerta para un grupo con stock bajo
 */
export function generateLowStockAlertMessage(group: TonerCompatibilityGroup): string {
  const colorLabel = group.key.color === 'black' ? 'Negro' :
                     group.key.color === 'cyan' ? 'Cian' :
                     group.key.color === 'magenta' ? 'Magenta' : 'Amarillo';
  
  return `Stock bajo: ${group.key.brand} ${group.key.model} (${colorLabel}) - ` +
         `Total: ${group.totalStock} unidades (mínimo: ${group.minStock}) - ` +
         `Proveedores: ${group.suppliers.join(', ')}`;
}
