import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Empresa, Estado, NuevaEmpresa } from './models';
import { SupabaseService } from './services/supabase.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);

  readonly estados: Estado[] = [
    'PENDIENTE',
    'CONTACTADA',
    'RESPONDIDO',
    'INTERESADA',
    'COLABORACION',
    'DESCARTADA'
  ];

  empresas = signal<Empresa[]>([]);
  filtro = signal<Estado | 'TODAS'>('TODAS');
  busqueda = signal('');
  actualId = signal<string | null>(null);
  cargando = signal(false);
  guardando = signal(false);
  error = signal<string | null>(null);
  mensajeSistema = signal<string | null>(null);

  filtradas = computed(() => {
    const q = this.busqueda().trim().toLowerCase();

    return this.empresas().filter(e => {
      const okEstado = this.filtro() === 'TODAS' || e.estado === this.filtro();
      const okTexto = !q || [
        e.empresa,
        e.instagram ?? '',
        e.sector ?? '',
        e.mensaje ?? ''
      ].some(v => v.toLowerCase().includes(q));

      return okEstado && okTexto;
    });
  });

  actual = computed(() => {
    const lista = this.filtradas();
    const id = this.actualId();
    return lista.find(e => e.id === id) ?? lista[0] ?? null;
  });

  pendientes = computed(() =>
    this.empresas().filter(e => e.estado === 'PENDIENTE').length
  );

  contactadasHoy = computed(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    return this.empresas().filter(e => e.fecha_contacto?.startsWith(hoy)).length;
  });

  async ngOnInit(): Promise<void> {
    await this.recargar();
  }

  async recargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);

    try {
      this.empresas.set(await this.supabase.obtenerEmpresas());
    } catch (err) {
      this.error.set(this.errorMessage(err));
    } finally {
      this.cargando.set(false);
    }
  }

  async importarCsv(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.guardando.set(true);
    this.error.set(null);
    this.mensajeSistema.set(null);

    try {
      const text = await file.text();
      const rows = this.parseCsv(text);

      if (rows.length < 2) {
        throw new Error('El CSV no contiene filas de datos.');
      }

      const headers = rows[0].map(h => h.trim().toLowerCase());
      const idx = (name: string) => headers.indexOf(name);

      if (idx('empresa') < 0) {
        throw new Error('El CSV debe contener la columna "empresa".');
      }

      const nuevas: NuevaEmpresa[] = rows
        .slice(1)
        .filter(r => r.some(c => c.trim()))
        .map((r, i) => {
          const estadoRaw = idx('estado') >= 0 ? r[idx('estado')]?.trim() : '';

          return {
            empresa: r[idx('empresa')]?.trim() || `Empresa ${i + 1}`,
            instagram: idx('instagram') >= 0
              ? (r[idx('instagram')] || '').trim().replace(/^@/, '') || null
              : null,
            sector: idx('sector') >= 0 ? r[idx('sector')]?.trim() || null : null,
            mensaje: idx('mensaje') >= 0 ? r[idx('mensaje')]?.trim() || null : null,
            estado: this.validEstado(estadoRaw) ? estadoRaw as Estado : 'PENDIENTE',
            notas: null,
            fecha_contacto: null
          };
        });

      const insertadas = await this.supabase.crearEmpresas(nuevas);
      this.empresas.update(lista => [...insertadas, ...lista]);
      this.mensajeSistema.set(`${insertadas.length} empresas importadas correctamente.`);
    } catch (err) {
      this.error.set(this.errorMessage(err));
    } finally {
      this.guardando.set(false);
      input.value = '';
    }
  }

  exportarCsv(): void {
    const esc = (value: string | null | undefined = '') =>
      `"${(value ?? '').replaceAll('"', '""')}"`;

    const header = [
      'empresa',
      'instagram',
      'sector',
      'mensaje',
      'estado',
      'fecha_contacto',
      'notas'
    ];

    const lines = this.empresas().map(e => [
      e.empresa,
      e.instagram,
      e.sector,
      e.mensaje,
      e.estado,
      e.fecha_contacto,
      e.notas
    ].map(esc).join(','));

    const blob = new Blob(
      [[header.join(','), ...lines].join('\n')],
      { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `empresas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async copiarMensaje(): Promise<void> {
    const e = this.actual();
    if (!e?.mensaje) return;
    await navigator.clipboard.writeText(e.mensaje);
    this.mensajeSistema.set('Mensaje copiado.');
  }

  abrirInstagram(): void {
    const e = this.actual();
    if (!e?.instagram) return;
    window.open(
      `https://www.instagram.com/${encodeURIComponent(e.instagram)}/`,
      '_blank',
      'noopener'
    );
  }

  async marcarContactadaYSiguiente(): Promise<void> {
    const e = this.actual();
    if (!e) return;

    await this.actualizarEmpresa(e, {
      estado: 'CONTACTADA',
      fecha_contacto: new Date().toISOString()
    });

    const lista = this.filtradas().filter(x => x.id !== e.id);
    this.actualId.set(lista[0]?.id ?? null);
  }

  async cambiarEstado(e: Empresa, estado: Estado): Promise<void> {
    await this.actualizarEmpresa(e, {
      estado,
      fecha_contacto:
        estado === 'CONTACTADA' && !e.fecha_contacto
          ? new Date().toISOString()
          : e.fecha_contacto
    });
  }

  async guardarNotas(e: Empresa, notas: string): Promise<void> {
    await this.actualizarEmpresa(e, { notas });
  }

  seleccionar(id: string): void {
    this.actualId.set(id);
  }

  siguiente(): void {
    const lista = this.filtradas();
    const e = this.actual();
    if (!lista.length || !e) return;

    const i = lista.findIndex(x => x.id === e.id);
    this.actualId.set(lista[(i + 1) % lista.length].id);
  }

  anterior(): void {
    const lista = this.filtradas();
    const e = this.actual();
    if (!lista.length || !e) return;

    const i = lista.findIndex(x => x.id === e.id);
    this.actualId.set(lista[(i - 1 + lista.length) % lista.length].id);
  }

  async borrarTodo(): Promise<void> {
    if (!confirm('¿Borrar TODAS las empresas de Supabase?')) return;

    this.guardando.set(true);
    this.error.set(null);

    try {
      await this.supabase.borrarTodas();
      this.empresas.set([]);
      this.actualId.set(null);
      this.mensajeSistema.set('Todas las empresas han sido eliminadas.');
    } catch (err) {
      this.error.set(this.errorMessage(err));
    } finally {
      this.guardando.set(false);
    }
  }

  private async actualizarEmpresa(
    original: Empresa,
    cambios: Partial<NuevaEmpresa>
  ): Promise<void> {
    this.guardando.set(true);
    this.error.set(null);

    const previo = { ...original };

    this.empresas.update(lista =>
      lista.map(e => e.id === original.id ? { ...e, ...cambios } as Empresa : e)
    );

    try {
      const actualizada = await this.supabase.actualizarEmpresa(original.id, cambios);
      this.empresas.update(lista =>
        lista.map(e => e.id === original.id ? actualizada : e)
      );
    } catch (err) {
      this.empresas.update(lista =>
        lista.map(e => e.id === original.id ? previo : e)
      );
      this.error.set(this.errorMessage(err));
    } finally {
      this.guardando.set(false);
    }
  }

  private validEstado(value?: string): value is Estado {
    return this.estados.includes(value as Estado);
  }

  private errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;

    if (
      typeof err === 'object' &&
      err !== null &&
      'message' in err &&
      typeof (err as { message?: unknown }).message === 'string'
    ) {
      return (err as { message: string }).message;
    }

    return 'Ha ocurrido un error inesperado.';
  }

  private parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"' && quoted && next === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = !quoted;
      } else if (c === ',' && !quoted) {
        row.push(cell);
        cell = '';
      } else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && next === '\n') i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += c;
      }
    }

    row.push(cell);
    rows.push(row);
    return rows;
  }
}
