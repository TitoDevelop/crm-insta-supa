export type Estado =
  | 'PENDIENTE'
  | 'CONTACTADA'
  | 'RESPONDIDO'
  | 'INTERESADA'
  | 'COLABORACION'
  | 'DESCARTADA';

export interface Empresa {
  id: string;
  empresa: string;
  instagram: string | null;
  sector: string | null;
  mensaje: string | null;
  estado: Estado;
  fecha_contacto: string | null;
  notas: string | null;
  created_at: string;
}

export interface NuevaEmpresa {
  empresa: string;
  instagram?: string | null;
  sector?: string | null;
  mensaje?: string | null;
  estado?: Estado;
  fecha_contacto?: string | null;
  notas?: string | null;
}
