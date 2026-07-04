type Props = {
  values: number[];
  stroke?: string;
  fill?: string;
  height?: number;
  label?: string;
};

export function Sparkline({ values, stroke = '#111111', fill = 'rgba(17,17,17,0.08)', height = 120, label }: Props) {
  const width = 320;
  if (!values.length) {
    return <figure className="sparkline" aria-label={label} />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const normalized = max === min ? 0.5 : (value - min) / (max - min);
      const y = height - normalized * (height - 12) - 6;
      return `${x},${y}`;
    })
    .join(' ');

  const area = `0,${height} ${points} ${width},${height}`;

  return (
    <figure className="sparkline" aria-label={label}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden={label ? undefined : true}>
        <defs>
          <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity="1" />
            <stop offset="100%" stopColor={fill} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#spark-fill)" />
        <polyline points={points} fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </figure>
  );
}
