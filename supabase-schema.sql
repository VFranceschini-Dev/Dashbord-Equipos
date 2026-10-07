-- ============================================
-- ESQUEMA DE BASE DE DATOS PARA SUPABASE
-- Sistema de Control de Tóner
-- ============================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLA: PRINTERS (Impresoras)
-- ============================================
CREATE TABLE IF NOT EXISTS printers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  toner_model TEXT NOT NULL DEFAULT '',
  last_maintenance TEXT NOT NULL DEFAULT '',
  total_pages INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_printers_user_id ON printers(user_id);
CREATE INDEX idx_printers_status ON printers(status);

-- ============================================
-- TABLA: TONER_ITEMS (Inventario de Tóner)
-- ============================================
CREATE TABLE IF NOT EXISTS toner_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  brand TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'black' CHECK (color IN ('black', 'cyan', 'magenta', 'yellow')),
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 2,
  max_stock INTEGER NOT NULL DEFAULT 10,
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  supplier TEXT NOT NULL DEFAULT '',
  last_restock TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_toner_items_user_id ON toner_items(user_id);
CREATE INDEX idx_toner_items_color ON toner_items(color);

-- ============================================
-- TABLA: MOVEMENTS (Movimientos de Tóner)
-- ============================================
CREATE TABLE IF NOT EXISTS movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('delivery', 'return', 'restock', 'disposal')),
  toner_id TEXT NOT NULL,
  toner_model TEXT NOT NULL,
  printer_id TEXT,
  printer_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  date TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_movements_user_id ON movements(user_id);
CREATE INDEX idx_movements_type ON movements(type);
CREATE INDEX idx_movements_date ON movements(date);

-- ============================================
-- TABLA: EQUIPMENTS (Equipamientos)
-- ============================================
CREATE TABLE IF NOT EXISTS equipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'desktop' CHECK (type IN ('desktop', 'laptop', 'server', 'monitor', 'peripheral', 'other')),
  brand TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  serial_number TEXT NOT NULL DEFAULT '',
  asset_tag TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Informática',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('assigned', 'available', 'maintenance', 'retired')),
  collaborator_id UUID REFERENCES collaborators(id) ON DELETE SET NULL,
  purchase_date TEXT NOT NULL DEFAULT '',
  warranty_end TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_equipments_user_id ON equipments(user_id);
CREATE INDEX idx_equipments_type ON equipments(type);
CREATE INDEX idx_equipments_status ON equipments(status);
CREATE INDEX idx_equipments_collaborator_id ON equipments(collaborator_id);

-- ============================================
-- TABLA: SUPPLIERS (Proveedores)
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cuit TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Hardware',
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX idx_suppliers_category ON suppliers(category);
CREATE INDEX idx_suppliers_active ON suppliers(active);

-- ============================================
-- TABLA: COLLABORATORS (Colaboradores)
-- ============================================
CREATE TABLE IF NOT EXISTS collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  dni TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT 'IT',
  position TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  equipment_count INTEGER NOT NULL DEFAULT 0,
  join_date TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_collaborators_user_id ON collaborators(user_id);
CREATE INDEX idx_collaborators_department ON collaborators(department);
CREATE INDEX idx_collaborators_active ON collaborators(active);

-- ============================================
-- TABLA: VOUCHERS (Comprobantes)
-- ============================================
CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('invoice', 'receipt', 'order', 'delivery', 'return')),
  supplier_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  date TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),
  description TEXT NOT NULL DEFAULT '',
  equipment_ids TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_vouchers_user_id ON vouchers(user_id);
CREATE INDEX idx_vouchers_type ON vouchers(type);
CREATE INDEX idx_vouchers_status ON vouchers(status);
CREATE INDEX idx_vouchers_date ON vouchers(date);

-- ============================================
-- TABLA: EXTERNAL_SERVERS (Servidores Externos)
-- ============================================
CREATE TABLE IF NOT EXISTS external_servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'meshcentral' CHECK (type IN ('meshcentral', 'custom')),
  url TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  auto_sync BOOLEAN NOT NULL DEFAULT false,
  sync_interval INTEGER NOT NULL DEFAULT 5,
  last_sync TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_external_servers_user_id ON external_servers(user_id);
CREATE INDEX idx_external_servers_type ON external_servers(type);
CREATE INDEX idx_external_servers_status ON external_servers(status);

-- ============================================
-- TABLA: SYNCED_DEVICES (Dispositivos Sincronizados)
-- ============================================
CREATE TABLE IF NOT EXISTS synced_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES external_servers(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  hostname TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  os TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  group_name TEXT DEFAULT '',
  cpu TEXT DEFAULT '',
  ram TEXT DEFAULT '',
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  local_equipment_id UUID REFERENCES equipments(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(server_id, external_id)
);

CREATE INDEX idx_synced_devices_user_id ON synced_devices(user_id);
CREATE INDEX idx_synced_devices_server_id ON synced_devices(server_id);
CREATE INDEX idx_synced_devices_status ON synced_devices(status);
CREATE INDEX idx_synced_devices_local_equipment_id ON synced_devices(local_equipment_id);

-- ============================================
-- TABLA: ALERTS (Alertas del Sistema)
-- ============================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('low_stock', 'maintenance', 'info', 'after_hours')),
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high')),
  date TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_type ON alerts(type);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_read ON alerts(read);

-- ============================================
-- FUNCIÓN: Actualizar updated_at automáticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas con updated_at
CREATE TRIGGER update_printers_updated_at BEFORE UPDATE ON printers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_toner_items_updated_at BEFORE UPDATE ON toner_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipments_updated_at BEFORE UPDATE ON equipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collaborators_updated_at BEFORE UPDATE ON collaborators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vouchers_updated_at BEFORE UPDATE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_external_servers_updated_at BEFORE UPDATE ON external_servers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_synced_devices_updated_at BEFORE UPDATE ON synced_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- POLÍTICAS DE SEGURIDAD (RLS - Row Level Security)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE toner_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE synced_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Políticas para cada tabla (los usuarios solo pueden ver sus propios datos)
CREATE POLICY "Users can view their own printers" ON printers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own printers" ON printers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own printers" ON printers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own printers" ON printers
  FOR DELETE USING (auth.uid() = user_id);

-- Repetir para todas las tablas...
CREATE POLICY "Users can view their own toner_items" ON toner_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own toner_items" ON toner_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own toner_items" ON toner_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own toner_items" ON toner_items
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own movements" ON movements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own movements" ON movements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own movements" ON movements
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own equipments" ON equipments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own equipments" ON equipments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own equipments" ON equipments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own equipments" ON equipments
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own suppliers" ON suppliers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own suppliers" ON suppliers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own suppliers" ON suppliers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own suppliers" ON suppliers
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own collaborators" ON collaborators
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own collaborators" ON collaborators
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collaborators" ON collaborators
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own collaborators" ON collaborators
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own vouchers" ON vouchers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vouchers" ON vouchers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vouchers" ON vouchers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vouchers" ON vouchers
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own external_servers" ON external_servers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own external_servers" ON external_servers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own external_servers" ON external_servers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own external_servers" ON external_servers
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own synced_devices" ON synced_devices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own synced_devices" ON synced_devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own synced_devices" ON synced_devices
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own synced_devices" ON synced_devices
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own alerts" ON alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alerts" ON alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts" ON alerts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alerts" ON alerts
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- FIN DEL ESQUEMA
-- ============================================
