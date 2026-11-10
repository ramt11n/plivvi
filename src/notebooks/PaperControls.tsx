import type { PaperSettings } from './model';

const colors = [
  ['White', '#ffffff'],
  ['Ivory', '#fff5dc'],
  ['Rose', '#fbe7ed'],
  ['Mint', '#e7f5ed'],
  ['Sky', '#e6efff'],
  ['Lavender', '#efe7ff'],
];

export default function PaperControls({
  value,
  onChange,
}: {
  value: PaperSettings;
  onChange: (value: PaperSettings) => void;
}) {
  return (
    <fieldset className="paper-controls">
      <legend>Paper appearance</legend>
      <div className="paper-swatches">
        {colors.map(([label, color]) => (
          <button
            type="button"
            key={color}
            title={label}
            aria-label={label + ' paper'}
            aria-pressed={value.pageColor === color}
            style={{ background: color }}
            onClick={() => onChange({ ...value, pageColor: color })}
          />
        ))}
      </div>
      <div className="paper-control-fields">
        <label>
          Page color
          <input
            type="color"
            value={value.pageColor}
            onChange={(e) => onChange({ ...value, pageColor: e.target.value })}
          />
        </label>
        <label>
          Line color
          <input
            type="color"
            value={value.lineColor}
            onChange={(e) => onChange({ ...value, lineColor: e.target.value })}
          />
        </label>
        <label>
          Line spacing
          <select
            value={value.spacing}
            onChange={(e) => onChange({ ...value, spacing: Number(e.target.value) })}
          >
            <option value={16}>Narrow</option>
            <option value={25}>Standard</option>
            <option value={34}>Wide</option>
          </select>
        </label>
        <label>
          Writing direction
          <select
            value={value.direction}
            onChange={(e) =>
              onChange({ ...value, direction: e.target.value as PaperSettings['direction'] })
            }
          >
            <option value="ltr">Left to right</option>
            <option value="rtl">Right to left</option>
          </select>
        </label>
      </div>
    </fieldset>
  );
}
