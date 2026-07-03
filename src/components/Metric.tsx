type Props = {
  label: string;
  value: string;
  caption?: string;
};

export function Metric({ label, value, caption }: Props) {
  return (
    <div className="metric">
      <div className="metric__label">{label}</div>
      <div className="metric__value">{value}</div>
      {caption ? <div className="metric__caption">{caption}</div> : null}
    </div>
  );
}
