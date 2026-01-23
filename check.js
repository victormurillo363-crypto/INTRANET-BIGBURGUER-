const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://nhuxbrlbzrulbncghtim.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5odXhicmxienJ1bGJuY2dodGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4OTY1MjAsImV4cCI6MjA4MDQ3MjUyMH0.xP55ysJ8HBoWlAyEiryQ_ZcbIkUtExe7k7BGcqmpUiE'
);

async function buscar() {
  // Buscar tabla de eventos en horarios
  const { data: horarios } = await supabase.from('horarios').select('*').order('semana_inicio', { ascending: false }).limit(2);
  console.log('=== Horarios recientes ===');
  if (horarios) {
    for (const h of horarios) {
      console.log('\nSemana:', h.semana_inicio, '-', h.semana_fin);
      console.log('Eventos:', JSON.stringify(h.eventos, null, 2));
      console.log('Eventos por dia:', JSON.stringify(h.eventos_por_dia, null, 2));
    }
  }
  
  // Ver un contrato completo
  const { data: contrato } = await supabase.from('contratos').select('*').limit(1);
  console.log('\n=== Contrato ejemplo ===');
  console.log(JSON.stringify(contrato?.[0], null, 2));
  
  process.exit(0);
}
buscar();
