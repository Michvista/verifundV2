type Props = {
  values: number[];
  height?: number;
  greenFrom?: number;
};

export function BarChart({ values, height = 180, greenFrom = 9 }: Props) {
  const safeValues = values.filter(Number.isFinite);

  if (!safeValues.length) {
    return <div className="empty-state">No history available.</div>;
  }
  const max = Math.max(...safeValues, 1);
  return (
    <div className="bar-chart" aria-hidden="true">
      {safeValues.map((value, index) => (
        <div
          key={index}
          className={`bar-chart__bar ${index >= greenFrom ? 'bar-chart__bar--green' : ''}`}
          style={{ height: `${(value / max) * height}px` }}
        />
      ))}
    </div>
  );
}
