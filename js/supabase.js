import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
let client;

export function getSupabaseClient() {
	if (!supabaseUrl) throw new Error('SUPABASE_URL belum tersedia untuk Vite.');
	if (!supabaseAnonKey) throw new Error('SUPABASE_ANON_KEY belum tersedia untuk Vite.');
	client ||= createClient(supabaseUrl, supabaseAnonKey);
	return client;
}

export async function supabaseRequest(table) {
	const { data, error } = await getSupabaseClient().from(table).select('*');
	if (error) throw new Error(`Gagal membaca tabel ${table}: ${error.message}`);
	return data;
}

export async function testSupabaseConnection() {
	const { data, error } = await getSupabaseClient().from('cash_accounts').select('id').limit(1);
	if (error) throw new Error(`Gagal membaca tabel cash_accounts: ${error.message}`);
	return { rowCount: data.length };
}