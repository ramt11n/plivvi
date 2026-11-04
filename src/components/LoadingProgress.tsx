export default function LoadingProgress({
  label,
  value,
  detail,
}: {
  label: string;
  value?: number;
  detail?: string;
}) {
  const measured = value === undefined ? undefined : Math.max(0, Math.min(100, value));
  return (
    <div className="loading-progress" role="status" aria-live="polite">
      <div className="loading-progress-heading">
        <span>{label}</span>
        {measured !== undefined && <span>{Math.round(measured)}%</span>}
      </div>
      <progress aria-label={label} max={100} value={measured} />
      {detail && <small>{detail}</small>}
    </div>
  );
}
