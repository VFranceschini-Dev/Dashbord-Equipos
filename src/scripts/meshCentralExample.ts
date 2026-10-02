// Script de ejemplo para conectar con MeshCentral
// Este script demuestra cómo usar el servicio MeshCentral

import { meshCentralService, MeshNode, MeshGroup } from '../services/meshCentral';

// ============================================
// CONFIGURACIÓN
// ============================================

// Opción 1: Configurar con credenciales directas
const config = {
  serverUrl: 'https://mesh.donnet.com.ar',  // URL de tu servidor MeshCentral
  username: 'admin',                         // Tu usuario
  password: 'tu_password',                   // Tu contraseña
  autoSync: true,                            // Sincronización automática
  syncInterval: 5,                           // Intervalo en minutos
};

// Aplicar configuración
meshCentralService.setConfig(config);

// ============================================
// CONEXIÓN Y OBTENCIÓN DE DATOS
// ============================================

async function ejemploUso() {
  try {
    // 1. Conectar al servidor
    console.log('Conectando a MeshCentral...');
    const connected = await meshCentralService.connect();
    
    if (!connected) {
      console.error('No se pudo conectar');
      return;
    }
    
    console.log('✅ Conectado exitosamente');

    // 2. Obtener lista de PCs/Nodos
    console.log('\n📋 Obteniendo lista de PCs...');
    const nodes = await meshCentralService.getNodes();
    
    console.log(`\nTotal de PCs: ${nodes.length}`);
    console.log('='.repeat(50));
    
    // 3. Mostrar información de cada PC
    nodes.forEach((node: MeshNode, index: number) => {
      console.log(`\nPC #${index + 1}:`);
      console.log(`  Nombre: ${node.name}`);
      console.log(`  Hostname: ${node.hostname}`);
      console.log(`  IP: ${node.ip}`);
      console.log(`  Sistema Operativo: ${node.os}`);
      console.log(`  Estado: ${node.status === 'connected' ? '🟢 Conectada' : '🔴 Desconectada'}`);
      console.log(`  Grupo: ${node.group || 'Sin grupo'}`);
      console.log(`  Última conexión: ${new Date(node.lastSeen).toLocaleString('es-AR')}`);
      if (node.cpu) console.log(`  CPU: ${node.cpu}`);
      if (node.ram) console.log(`  RAM: ${node.ram}`);
    });

    // 4. Estadísticas
    const connectedCount = nodes.filter(n => n.status === 'connected').length;
    const disconnectedCount = nodes.filter(n => n.status === 'disconnected').length;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 ESTADÍSTICAS:');
    console.log(`  Total: ${nodes.length}`);
    console.log(`  Conectadas: ${connectedCount} (${((connectedCount/nodes.length)*100).toFixed(1)}%)`);
    console.log(`  Desconectadas: ${disconnectedCount} (${((disconnectedCount/nodes.length)*100).toFixed(1)}%)`);

    // 5. Obtener grupos
    console.log('\n📁 Obteniendo grupos...');
    const groups = await meshCentralService.getGroups();
    
    console.log(`\nTotal de grupos: ${groups.length}`);
    groups.forEach((group: MeshGroup, index: number) => {
      console.log(`\nGrupo #${index + 1}:`);
      console.log(`  Nombre: ${group.name}`);
      console.log(`  Descripción: ${group.description || 'Sin descripción'}`);
      console.log(`  PCs totales: ${group.nodeCount}`);
      console.log(`  PCs conectadas: ${group.connectedCount}`);
    });

    // 6. Filtrar PCs por estado
    console.log('\n🔍 PCs Conectadas:');
    const connectedNodes = nodes.filter((n: MeshNode) => n.status === 'connected');
    connectedNodes.forEach((node: MeshNode) => {
      console.log(`  ✅ ${node.name} (${node.ip})`);
    });

    console.log('\n🔍 PCs Desconectadas:');
    const disconnectedNodes = nodes.filter((n: MeshNode) => n.status === 'disconnected');
    disconnectedNodes.forEach((node: MeshNode) => {
      console.log(`  ❌ ${node.name} (${node.ip})`);
    });

    // 7. Buscar PC por nombre
    console.log('\n🔎 Buscando PC específica...');
    const pcBuscada = nodes.find(n => n.name.toLowerCase().includes('pc-01'));
    if (pcBuscada) {
      console.log(`✅ PC encontrada: ${pcBuscada.name}`);
      console.log(`   Estado: ${pcBuscada.status}`);
      console.log(`   IP: ${pcBuscada.ip}`);
    } else {
      console.log('❌ PC no encontrada');
    }

    // 8. Exportar datos a JSON
    console.log('\n💾 Exportando datos a JSON...');
    const exportData = {
      fecha: new Date().toISOString(),
      totalPCs: nodes.length,
      pcs: nodes,
      grupos: groups,
    };
    
    console.log(JSON.stringify(exportData, null, 2));

    // 9. Iniciar sincronización automática
    if (config.autoSync) {
      console.log(`\n🔄 Iniciando sincronización automática cada ${config.syncInterval} minutos...`);
      meshCentralService.startAutoSync(config.syncInterval);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// ============================================
// LISTENERS PARA EVENTOS EN TIEMPO REAL
// ============================================

// Escuchar cambios en los nodos
meshCentralService.addListener((event: string, data: any) => {
  if (event === 'nodesUpdated') {
    console.log('\n🔄 Nodos actualizados:', data.length, 'PCs');
    // Aquí puedes actualizar tu UI o base de datos
  }
  
  if (event === 'connected') {
    console.log('✅ Conectado a MeshCentral');
  }
  
  if (event === 'disconnected') {
    console.log('❌ Desconectado de MeshCentral');
  }
});

// ============================================
// EJECUTAR EJEMPLO
// ============================================

// Descomenta la siguiente línea para ejecutar el ejemplo
// ejemploUso();

// ============================================
// FUNCIONES AUXILIARES
// ============================================

// Función para convertir nodos de MeshCentral a formato de Equipment
export function meshNodesToEquipment(nodes: MeshNode[]) {
  return nodes.map(node => ({
    name: node.name,
    type: 'desktop',
    brand: 'MeshCentral',
    model: node.os || 'Unknown',
    serialNumber: node.id,
    assetTag: `MESH-${node.id.substring(0, 8)}`,
    category: 'Informática',
    status: node.status === 'connected' ? 'assigned' : 'available',
    purchaseDate: new Date().toISOString().split('T')[0],
    warrantyEnd: '',
    notes: `Importado desde MeshCentral. IP: ${node.ip}, Hostname: ${node.hostname}`,
    meshNodeId: node.id,
  }));
}

// Función para verificar estado de una PC específica
export async function checkPCStatus(pcName: string) {
  const nodes = await meshCentralService.getNodes();
  const pc = nodes.find(n => n.name.toLowerCase() === pcName.toLowerCase());
  
  if (!pc) {
    return { found: false, message: 'PC no encontrada' };
  }
  
  return {
    found: true,
    name: pc.name,
    status: pc.status,
    ip: pc.ip,
    os: pc.os,
    lastSeen: pc.lastSeen,
  };
}

// Función para obtener PCs por grupo
export async function getPCsByGroup(groupName: string) {
  const nodes = await meshCentralService.getNodes();
  return nodes.filter((n: MeshNode) => n.group?.toLowerCase() === groupName.toLowerCase());
}

// Función para obtener solo PCs conectadas
export async function getConnectedPCs() {
  const nodes = await meshCentralService.getNodes();
  return nodes.filter((n: MeshNode) => n.status === 'connected');
}

// Función para obtener solo PCs desconectadas
export async function getDisconnectedPCs() {
  const nodes = await meshCentralService.getNodes();
  return nodes.filter((n: MeshNode) => n.status === 'disconnected');
}

export { ejemploUso };
