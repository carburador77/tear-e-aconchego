'use client';

type ColorSettingFieldProps = {
  id: string;
  label: string;
  description: string;
  value: string;
  savedValue: string;
  onChange: (value: string) => void;
  onRestore: () => void;
};

export function normalizeHex(value: string) {
  const candidate = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate.toUpperCase() : null;
}

export function hexToRgb(value: string) {
  const hex = normalizeHex(value);
  if (!hex) return null;
  return [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)] as const;
}

export default function ColorSettingField({ id, label, description, value, savedValue, onChange, onRestore }: ColorSettingFieldProps) {
  const normalized = normalizeHex(value);
  const saved = normalizeHex(savedValue) ?? '#000000';
  const rgb = normalized ? hexToRgb(normalized) : null;
  const changed = normalized !== (normalizeHex(savedValue) ?? saved) || (!normalized && value.trim() !== savedValue.trim());

  return <div className="rounded-lg border border-[#d7cabc] bg-[#fffdf9] p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-[#302518]">{label}</h3>
        <p className="mt-1 text-xs leading-relaxed text-[#6e6254]">{description}</p>
      </div>
      {changed && <span className="shrink-0 rounded-full bg-[#f2e1bd] px-2 py-1 text-[10px] font-semibold text-[#5c482d]">Não salvo</span>}
    </div>

    <div className="mt-4 flex flex-wrap items-center gap-3">
      <label className="relative h-10 w-10 cursor-pointer overflow-hidden rounded-md border border-[#a99c8c] shadow-sm" style={{ backgroundColor: normalized ?? saved }}>
        <span className="sr-only">Selecionar {label}</span>
        <input aria-label={`Selecionar ${label}`} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" type="color" value={normalized ?? saved} onChange={(event) => onChange(event.target.value.toUpperCase())} />
      </label>
      <label className="min-w-[132px] flex-1 text-xs font-semibold text-[#4c4034]">HEX
        <input aria-invalid={Boolean(value.trim() && !normalized)} aria-describedby={`${id}-help`} className="mt-1 w-full font-mono uppercase" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} onBlur={(event) => { const normalizedValue = normalizeHex(event.target.value); if (normalizedValue) onChange(normalizedValue); }} placeholder="#RRGGBB" inputMode="text" autoComplete="off" />
      </label>
      <button type="button" disabled={!changed} onClick={onRestore} className="self-end pb-1 text-xs font-semibold underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-40">Restaurar</button>
    </div>

    <p id={`${id}-help`} className={`mt-2 text-xs ${normalized ? 'text-[#6e6254]' : 'text-red-700'}`}>
      {normalized && rgb ? `RGB ${rgb.join(', ')}` : 'Informe um código HEX válido, por exemplo #997245.'}
    </p>
  </div>;
}
