import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Empresa, NuevaEmpresa } from '../models';
import { SUPABASE_CONFIG } from '../supabase.config';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private readonly supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.publishableKey
    );
  }

  async obtenerEmpresas(): Promise<Empresa[]> {
    const { data, error } = await this.supabase
      .from('empresas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Empresa[];
  }

  async crearEmpresas(empresas: NuevaEmpresa[]): Promise<Empresa[]> {
    if (!empresas.length) return [];

    const { data, error } = await this.supabase
      .from('empresas')
      .insert(empresas)
      .select();

    if (error) throw error;
    return (data ?? []) as Empresa[];
  }

  async actualizarEmpresa(id: string, cambios: Partial<NuevaEmpresa>): Promise<Empresa> {
    const { data, error } = await this.supabase
      .from('empresas')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Empresa;
  }

  async borrarTodas(): Promise<void> {
    const { error } = await this.supabase
      .from('empresas')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) throw error;
  }
}
