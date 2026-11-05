// Inyecta un botón "Exportar ofertas" junto al filtro de ubicación de LinkedIn Jobs
// y abre un panel en la página para elegir ofertas, campos y formato de exportación.
(() => {
  if (window.__lkExportOfertas) return;
  window.__lkExportOfertas = true;

  const BTN_ID = 'lk-export-ofertas-btn';
  const HOST_ID = 'lk-export-ofertas-panel';
  const STORAGE_KEY = 'lkExportConfig';

  // ---------- Idioma ----------
  // Sigue el idioma de LinkedIn (<html lang>): español si es "es*", inglés en cualquier otro caso.
  const idioma = () => ((document.documentElement.lang || '').toLowerCase().startsWith('es') ? 'es' : 'en');

  const TEXTOS = {
    es: {
      boton: 'Exportar ofertas',
      titulo: 'Exportar ofertas de LinkedIn',
      cerrar: 'Cerrar',
      campos: 'Campos', todos: 'Todos', ninguno: 'Ninguno',
      formato: 'Formato', separador: 'Separador', incluirCabecera: 'Incluir cabecera',
      vistaPrevia: 'Vista previa',
      copiar: 'Copiar', descargar: 'Descargar',
      ofertas: 'Ofertas', todas: 'Todas', ninguna: 'Ninguna',
      seleccionadas: (n, total) => `${n}/${total} seleccionadas`,
      copiadas: n => `✓ ${n} ofertas copiadas`,
      errorCopiar: 'No se pudo copiar al portapapeles',
      descargado: (ext, n) => `✓ Descargado .${ext} (${n} ofertas)`,
      sinOfertas: 'No encontré ofertas. ¿Ha cargado la lista? Si LinkedIn cambió su HTML, hay que ajustar los selectores.',
      si: 'Sí', no: 'No',
      archivo: 'ofertas-linkedin',
      campo: {
        titulo: 'Título', empresa: 'Empresa', ubicacion: 'Ubicación', modalidad: 'Modalidad', salario: 'Salario',
        publicado: 'Publicado', solicitudSencilla: 'Solicitud sencilla', verificado: 'Verificado',
        promocionado: 'Promocionado', visto: 'Visto', id: 'ID', url: 'Link',
      },
      fmt: {
        texto: 'Texto (título | empresa | …)', csv: 'CSV', tsv: 'TSV (pegar en Excel / Sheets)',
        markdown: 'Tabla Markdown', json: 'JSON',
      },
      sep: { ';': 'Punto y coma ; (Excel en español)', ',': 'Coma , (estándar)', '|': 'Barra vertical |' },
    },
    en: {
      boton: 'Export jobs',
      titulo: 'Export LinkedIn jobs',
      cerrar: 'Close',
      campos: 'Fields', todos: 'All', ninguno: 'None',
      formato: 'Format', separador: 'Separator', incluirCabecera: 'Include header',
      vistaPrevia: 'Preview',
      copiar: 'Copy', descargar: 'Download',
      ofertas: 'Jobs', todas: 'All', ninguna: 'None',
      seleccionadas: (n, total) => `${n}/${total} selected`,
      copiadas: n => `✓ ${n} jobs copied`,
      errorCopiar: 'Could not copy to clipboard',
      descargado: (ext, n) => `✓ Downloaded .${ext} (${n} jobs)`,
      sinOfertas: 'No jobs found. Has the list loaded? If LinkedIn changed its HTML, the selectors need updating.',
      si: 'Yes', no: 'No',
      archivo: 'linkedin-jobs',
      campo: {
        titulo: 'Title', empresa: 'Company', ubicacion: 'Location', modalidad: 'Workplace', salario: 'Salary',
        publicado: 'Posted', solicitudSencilla: 'Easy Apply', verificado: 'Verified',
        promocionado: 'Promoted', visto: 'Viewed', id: 'ID', url: 'Link',
      },
      fmt: {
        texto: 'Text (title | company | …)', csv: 'CSV', tsv: 'TSV (paste into Excel / Sheets)',
        markdown: 'Markdown table', json: 'JSON',
      },
      sep: { ';': 'Semicolon ;', ',': 'Comma , (standard)', '|': 'Pipe |' },
    },
  };
  const T = () => TEXTOS[idioma()];

  // Textos de LinkedIn que se buscan en la página (se aceptan ambos idiomas siempre)
  const LK = {
    finLista: /Hemos encontrado más resultados|may not be exact matches|more results related to your search/i,
    ubicacion: ['Ubicación', 'Location'],
    publicado: /^(Publicado|Posted)\b\s*/,
    solicitudSencilla: ['Solicitud sencilla', 'Easy Apply'],
    promocionado: ['Promocionado', 'Promoted'],
    visto: ['Visto', 'Viewed'],
    verificado: /Empleo verificado|Verified job/i,
    salario: /[€$£]|\/(month|mes|year|año|yr|hour|hora|hr|mo)\b/i,
  };

  // ---------- Campos y formatos ----------
  // Las claves son fijas (se usan en JSON y en la configuración); las etiquetas salen de TEXTOS.
  const CAMPOS = [
    { key: 'titulo' }, { key: 'empresa' }, { key: 'ubicacion' }, { key: 'modalidad' }, { key: 'salario' },
    { key: 'publicado' }, { key: 'solicitudSencilla', bool: true }, { key: 'verificado', bool: true },
    { key: 'promocionado', bool: true }, { key: 'visto', bool: true }, { key: 'id' }, { key: 'url' },
  ];

  const FORMATOS = {
    texto: { ext: 'txt', mime: 'text/plain' },
    csv: { ext: 'csv', mime: 'text/csv' },
    tsv: { ext: 'tsv', mime: 'text/tab-separated-values' },
    markdown: { ext: 'md', mime: 'text/markdown' },
    json: { ext: 'json', mime: 'application/json' },
  };

  const SEPARADORES_CSV = [';', ',', '|'];

  const CONFIG_DEFECTO = {
    campos: ['titulo', 'empresa', 'url'],
    formato: 'texto',
    separador: ';',
    cabecera: true,
  };

  // ---------- Extracción ----------
  function extraerOfertas() {
    const divider = [...document.querySelectorAll('p')].find(p => LK.finLista.test(p.textContent));
    const cards = [...document.querySelectorAll('[role="button"][componentkey^="job-card-component-ref-"]')];
    const seen = new Set();
    return cards
      .filter(c => !divider || (c.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING))
      .map(c => {
        const id = c.getAttribute('componentkey').replace('job-card-component-ref-', '');
        if (seen.has(id)) return null;
        seen.add(id);
        const ps = [...c.querySelectorAll('p')].map(p => p.innerText.trim()).filter(Boolean);
        const lineasTitulo = (ps[0] || '').split('\n');
        const loc = (ps[2] || '').match(/^(.*?)\s*\(([^)]+)\)\s*$/);
        const resto = ps.slice(3);
        const tiene = textos => resto.some(t => textos.includes(t));
        const publicado = resto.find(t => LK.publicado.test(t));
        return {
          id,
          titulo: lineasTitulo[lineasTitulo.length - 1].trim(),
          empresa: (ps[1] || '').trim(),
          ubicacion: loc ? loc[1] : (ps[2] || ''),
          modalidad: loc ? loc[2] : '',
          salario: resto.find(t => LK.salario.test(t)) || '',
          publicado: publicado ? (publicado.split('\n')[1] || publicado.replace(LK.publicado, '')).trim() : '',
          solicitudSencilla: tiene(LK.solicitudSencilla),
          verificado: LK.verificado.test(lineasTitulo[0]),
          promocionado: tiene(LK.promocionado),
          visto: tiene(LK.visto),
          url: `https://www.linkedin.com/jobs/view/${id}/`,
        };
      })
      .filter(Boolean);
  }

  // ---------- Generación de salida ----------
  function generar(ofertas, cfg) {
    const t = T();
    const campos = CAMPOS.filter(c => cfg.campos.includes(c.key));
    const val = (o, c) => (c.bool ? (o[c.key] ? t.si : t.no) : String(o[c.key] ?? ''));
    const filas = ofertas.map(o => campos.map(c => val(o, c)));
    const cab = campos.map(c => t.campo[c.key]);

    switch (cfg.formato) {
      case 'csv': {
        const esc = v => `"${v.replace(/"/g, '""')}"`;
        return [...(cfg.cabecera ? [cab] : []), ...filas].map(f => f.map(esc).join(cfg.separador)).join('\r\n');
      }
      case 'tsv': {
        const limpio = v => v.replace(/[\t\r\n]+/g, ' ');
        return [...(cfg.cabecera ? [cab] : []), ...filas].map(f => f.map(limpio).join('\t')).join('\n');
      }
      case 'markdown': {
        const esc = v => v.replace(/\|/g, '\\|').replace(/\n/g, ' ');
        const linea = f => `| ${f.map(esc).join(' | ')} |`;
        return [linea(cab), `| ${cab.map(() => '---').join(' | ')} |`, ...filas.map(linea)].join('\n');
      }
      case 'json': // claves fijas, independientes del idioma
        return JSON.stringify(
          ofertas.map(o => Object.fromEntries(campos.map(c => [c.key, o[c.key]]))),
          null, 2
        );
      default: // texto (sin cabecera: estorba al pegar)
        return filas.map(f => f.filter(Boolean).join(' | ')).join('\n');
    }
  }

  // ---------- Configuración persistente ----------
  const cargarConfig = () => new Promise(res => {
    try {
      chrome.storage.local.get(STORAGE_KEY, r => {
        const cfg = { ...CONFIG_DEFECTO, ...(r?.[STORAGE_KEY] || {}) };
        // Migración de versiones anteriores (csvPC / csvComa → csv + separador)
        if (cfg.formato === 'csvPC') Object.assign(cfg, { formato: 'csv', separador: ';' });
        if (cfg.formato === 'csvComa') Object.assign(cfg, { formato: 'csv', separador: ',' });
        if (!FORMATOS[cfg.formato]) cfg.formato = CONFIG_DEFECTO.formato;
        if (!SEPARADORES_CSV.includes(cfg.separador)) cfg.separador = CONFIG_DEFECTO.separador;
        delete cfg.copiarAlAbrir;
        res(cfg);
      });
    } catch { res({ ...CONFIG_DEFECTO }); }
  });
  const guardarConfig = cfg => { try { chrome.storage.local.set({ [STORAGE_KEY]: cfg }); } catch {} };

  // ---------- Botón ----------
  function insertarBoton() {
    if (document.getElementById(BTN_ID)) return;
    const header = document.querySelector('[componentkey="searchResultsHeaderComponent"]');
    const ubicacion = header && LK.ubicacion
      .map(txt => header.querySelector(`[aria-label^="${txt}"]`))
      .find(Boolean);
    const ancla = ubicacion?.closest('[role="button"]') || ubicacion;
    if (!ancla) return;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.textContent = T().boton;
    Object.assign(btn.style, {
      marginLeft: '8px', height: '36px', padding: '0 16px', borderRadius: '18px',
      borderWidth: '1px', borderStyle: 'solid',
      font: '600 14px -apple-system, system-ui, "Segoe UI", Roboto, sans-serif',
      cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: '0', alignSelf: 'center',
    });
    const pintar = hover => {
      const t = TEMAS[temaActual()];
      Object.assign(btn.style, { borderColor: t.acento, color: t.acento, background: hover ? t.acentoSuave : 'transparent' });
    };
    btn.__pintar = pintar;
    pintar(false);
    btn.addEventListener('mouseenter', () => pintar(true));
    btn.addEventListener('mouseleave', () => pintar(false));
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      abrirPanel();
    });
    ancla.insertAdjacentElement('afterend', btn);
  }

  // ---------- Tema (claro / oscuro) ----------
  // LinkedIn indica el tema elegido por el usuario en <body data-color-scheme="dark|light">.
  // Si algún día desaparece, se deduce por la luminosidad del fondo de la página.
  function temaActual() {
    const attr = document.body?.dataset.colorScheme;
    if (attr === 'dark' || attr === 'light') return attr;
    const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
    return m && (+m[0] * 299 + +m[1] * 587 + +m[2] * 114) / 1000 < 128 ? 'dark' : 'light';
  }

  // Colores tomados de la propia interfaz de LinkedIn en cada modo
  const TEMAS = {
    light: {
      esquema: 'light', fondo: '#ffffff', fondoSuave: '#f7f7f7', texto: 'rgba(0,0,0,.9)', textoSuave: 'rgba(0,0,0,.6)',
      borde: '#c8c8c8', bordeSuave: '#ececec', acento: '#0a66c2', acentoSuave: 'rgba(10,102,194,.1)', textoSobreAcento: '#ffffff',
      ok: '#057642', err: '#b24020', sombra: 'rgba(0,0,0,.25)', velo: 'rgba(0,0,0,.35)',
    },
    dark: {
      esquema: 'dark', fondo: '#1b1f23', fondoSuave: '#25292d', texto: 'rgba(255,255,255,.9)', textoSuave: 'rgba(255,255,255,.6)',
      borde: 'rgba(255,255,255,.3)', bordeSuave: 'rgba(255,255,255,.12)', acento: '#71b7fb', acentoSuave: 'rgba(113,183,251,.15)', textoSobreAcento: '#1b1f23',
      ok: '#7fc15e', err: '#f5987e', sombra: 'rgba(0,0,0,.6)', velo: 'rgba(0,0,0,.55)',
    },
  };

  const varsTema = t => Object.entries({
    '--esquema': t.esquema, '--fondo': t.fondo, '--fondo-suave': t.fondoSuave, '--texto': t.texto, '--texto-suave': t.textoSuave,
    '--borde': t.borde, '--borde-suave': t.bordeSuave, '--acento': t.acento, '--acento-suave': t.acentoSuave,
    '--texto-sobre-acento': t.textoSobreAcento, '--ok': t.ok, '--err': t.err, '--sombra': t.sombra, '--velo': t.velo,
  }).map(([k, v]) => `${k}: ${v};`).join(' ');

  function aplicarTema() {
    const t = TEMAS[temaActual()];
    document.getElementById(BTN_ID)?.__pintar?.(false);
    const host = document.getElementById(HOST_ID);
    if (host) host.shadowRoot.querySelector('style[data-tema]').textContent = `:host { ${varsTema(t)} }`;
  }

  // ---------- Panel ----------
  const CSS = `
    * { box-sizing: border-box; }
    .overlay { position: fixed; inset: 0; background: var(--velo); z-index: 2147483646;
      display: flex; align-items: flex-start; justify-content: center; padding-top: 60px; }
    .panel { color-scheme: var(--esquema); background: var(--fondo); color: var(--texto);
      width: 640px; max-width: calc(100vw - 32px); max-height: calc(100vh - 90px);
      display: flex; flex-direction: column; border-radius: 10px; box-shadow: 0 8px 32px var(--sombra);
      padding: 16px; font: 13px -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; }
    .top { display: flex; align-items: center; justify-content: space-between; }
    h1 { font-size: 16px; margin: 0; }
    h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--texto-suave); margin: 14px 0 6px; display: flex; justify-content: space-between; align-items: baseline; }
    h2 small { text-transform: none; letter-spacing: 0; font-weight: 400; }
    h2 small a { color: var(--acento); cursor: pointer; margin-left: 8px; }
    .close { border: 0; background: none; font-size: 22px; line-height: 1; cursor: pointer; color: var(--texto-suave); padding: 0 4px; }
    .close:hover { color: var(--texto); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px 3px 6px; border: 1px solid var(--borde);
      border-radius: 14px; cursor: pointer; user-select: none; }
    .chip:has(input:checked) { border-color: var(--acento); background: var(--acento-suave); color: var(--acento); font-weight: 600; }
    .chip input { margin: 0; accent-color: var(--acento); }
    .row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    select { font: inherit; padding: 4px 6px; border-radius: 6px; border: 1px solid var(--borde); background: var(--fondo); color: var(--texto); }
    label.opt { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
    label.opt input { accent-color: var(--acento); }
    textarea { width: 100%; height: 120px; resize: vertical; font: 12px ui-monospace, Consolas, monospace;
      border: 1px solid var(--borde); border-radius: 6px; padding: 6px; color: var(--texto); background: var(--fondo-suave); white-space: pre; }
    .acciones { display: flex; gap: 8px; margin-top: 10px; align-items: center; }
    .acciones button { padding: 7px 18px; cursor: pointer; border: 1px solid var(--acento); background: var(--acento);
      color: var(--texto-sobre-acento); border-radius: 16px; font-weight: 600; font-size: 13px; }
    .acciones button.sec { background: transparent; color: var(--acento); }
    .acciones button.sec:hover { background: var(--acento-suave); }
    .acciones button:not(.sec):hover { filter: brightness(.92); }
    .acciones button:disabled { opacity: .4; cursor: default; }
    .status { margin-left: auto; color: var(--texto-suave); font-size: 12px; }
    .status.ok { color: var(--ok); } .status.err { color: var(--err); }
    ol { margin: 0; padding: 0; list-style: none; overflow-y: auto; min-height: 60px; flex: 1;
      border: 1px solid var(--borde-suave); border-radius: 6px; }
    li { display: flex; gap: 8px; align-items: flex-start; padding: 5px 8px; border-bottom: 1px solid var(--borde-suave); }
    li:last-child { border-bottom: 0; }
    li input { margin-top: 3px; accent-color: var(--acento); }
    li a { color: var(--acento); text-decoration: none; font-weight: 600; }
    li a:hover { text-decoration: underline; }
    li span { display: block; color: var(--texto-suave); font-size: 12px; }
  `;

  const el = (tag, attrs = {}, ...hijos) => {
    // Sin innerHTML: LinkedIn aplica Trusted Types y vacía el HTML insertado así.
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k in n && typeof v === 'boolean') n[k] = v;
      else n.setAttribute(k, v);
    }
    n.append(...hijos);
    return n;
  };

  const opcion = (value, texto, seleccionado) => {
    const o = el('option', { value }, texto);
    o.selected = seleccionado;
    return o;
  };

  async function abrirPanel() {
    document.getElementById(HOST_ID)?.remove();
    const t = T();
    const cfg = await cargarConfig();
    const ofertas = extraerOfertas();
    const seleccion = new Set(ofertas.map(o => o.id));

    const host = el('div', { id: HOST_ID });
    const root = host.attachShadow({ mode: 'open' });
    const style = el('style');
    style.textContent = CSS;
    const styleTema = el('style', { 'data-tema': '' });
    styleTema.textContent = `:host { ${varsTema(TEMAS[temaActual()])} }`;

    const status = el('span', { class: 'status' });
    const setStatus = (msg, cls = '') => { status.textContent = msg; status.className = 'status ' + cls; };
    const preview = el('textarea', { readonly: true, spellcheck: 'false' });
    const contador = el('small');

    const elegidas = () => ofertas.filter(o => seleccion.has(o.id));
    const salida = () => generar(elegidas(), cfg);
    const refrescar = () => {
      guardarConfig(cfg);
      preview.value = cfg.campos.length && seleccion.size ? salida() : '';
      contador.textContent = t.seleccionadas(seleccion.size, ofertas.length);
      btnCopiar.disabled = btnDescargar.disabled = !cfg.campos.length || !seleccion.size;
      // Cabecera solo aplica a CSV/TSV (Markdown siempre la lleva; texto y JSON no)
      lblCabecera.style.display = ['csv', 'tsv'].includes(cfg.formato) ? '' : 'none';
      selSeparador.style.display = cfg.formato === 'csv' ? '' : 'none';
    };

    // Campos
    const chipsCampos = el('div', { class: 'chips' },
      ...CAMPOS.map(c => el('label', { class: 'chip' },
        el('input', {
          type: 'checkbox', checked: cfg.campos.includes(c.key),
          onchange: e => {
            cfg.campos = e.target.checked
              ? CAMPOS.map(x => x.key).filter(k => k === c.key || cfg.campos.includes(k))
              : cfg.campos.filter(k => k !== c.key);
            refrescar();
          },
        }),
        t.campo[c.key])));
    const marcarCampos = todos => {
      cfg.campos = todos ? CAMPOS.map(c => c.key) : [];
      chipsCampos.querySelectorAll('input').forEach(i => (i.checked = todos));
      refrescar();
    };

    // Formato y opciones
    const selFormato = el('select', { onchange: e => { cfg.formato = e.target.value; refrescar(); } },
      ...Object.keys(FORMATOS).map(k => opcion(k, t.fmt[k], k === cfg.formato)));
    const selSeparador = el('select', { title: t.separador, onchange: e => { cfg.separador = e.target.value; refrescar(); } },
      ...SEPARADORES_CSV.map(s => opcion(s, t.sep[s], s === cfg.separador)));
    const chkCabecera = el('input', { type: 'checkbox', checked: cfg.cabecera, onchange: e => { cfg.cabecera = e.target.checked; refrescar(); } });
    const lblCabecera = el('label', { class: 'opt' }, chkCabecera, t.incluirCabecera);

    // Acciones
    const copiar = async () => {
      try {
        await navigator.clipboard.writeText(salida());
        setStatus(t.copiadas(seleccion.size), 'ok');
      } catch {
        setStatus(t.errorCopiar, 'err');
      }
    };
    const descargar = () => {
      const f = FORMATOS[cfg.formato];
      // BOM en CSV/TSV para que Excel lea bien tildes y ñ
      const bom = ['csv', 'tsv'].includes(f.ext) ? String.fromCharCode(0xFEFF) : '';
      const blob = new Blob([bom + salida()], { type: `${f.mime};charset=utf-8` });
      const a = el('a', { href: URL.createObjectURL(blob), download: `${t.archivo}-${new Date().toISOString().slice(0, 10)}.${f.ext}` });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setStatus(t.descargado(f.ext, seleccion.size), 'ok');
    };
    const btnCopiar = el('button', { onclick: copiar }, t.copiar);
    const btnDescargar = el('button', { class: 'sec', onclick: descargar }, t.descargar);

    // Lista de ofertas
    const lista = el('ol', {}, ...ofertas.map(o => el('li', {},
      el('input', {
        type: 'checkbox', checked: true,
        onchange: e => { e.target.checked ? seleccion.add(o.id) : seleccion.delete(o.id); refrescar(); },
      }),
      el('div', {},
        el('a', { href: o.url, target: '_blank', rel: 'noopener' }, o.titulo || o.url),
        el('span', {}, [o.empresa, o.ubicacion && `${o.ubicacion}${o.modalidad ? ` (${o.modalidad})` : ''}`, o.salario].filter(Boolean).join(' · '))))));
    const marcarOfertas = todas => {
      seleccion.clear();
      if (todas) ofertas.forEach(o => seleccion.add(o.id));
      lista.querySelectorAll('input').forEach(i => (i.checked = todas));
      refrescar();
    };

    const cerrar = () => { host.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = e => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', onKey, true);

    const overlay = el('div', { class: 'overlay', onclick: e => { if (e.target === e.currentTarget) cerrar(); } },
      el('div', { class: 'panel', role: 'dialog', 'aria-label': t.boton, lang: idioma() },
        el('div', { class: 'top' }, el('h1', {}, t.titulo), el('button', { class: 'close', title: t.cerrar, 'aria-label': t.cerrar, onclick: cerrar }, '×')),
        el('h2', {}, t.campos, el('small', {}, el('a', { onclick: () => marcarCampos(true) }, t.todos), el('a', { onclick: () => marcarCampos(false) }, t.ninguno))),
        chipsCampos,
        el('h2', {}, t.formato),
        el('div', { class: 'row' }, selFormato, selSeparador, lblCabecera),
        el('h2', {}, t.vistaPrevia),
        preview,
        el('div', { class: 'acciones' }, btnCopiar, btnDescargar, status),
        el('h2', {}, t.ofertas, el('small', {}, contador, el('a', { onclick: () => marcarOfertas(true) }, t.todas), el('a', { onclick: () => marcarOfertas(false) }, t.ninguna))),
        lista));

    root.append(styleTema, style, overlay);
    document.body.appendChild(host);

    refrescar();
    if (!ofertas.length) setStatus(t.sinOfertas, 'err');
  }

  // ---------- LinkedIn es SPA: reinsertar el botón cuando re-renderiza ----------
  let pendiente = false;
  new MutationObserver(() => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => { pendiente = false; insertarBoton(); });
  }).observe(document.documentElement, { childList: true, subtree: true });

  // Si el usuario cambia de tema en LinkedIn, actualizar botón y panel al momento
  new MutationObserver(aplicarTema).observe(document.body, { attributes: true, attributeFilter: ['data-color-scheme'] });

  insertarBoton();
})();
