interface ScoreRadarChartProps {
  scores: {
    label: string;
    value: number; // 0-100
  }[];
  size?: number;
}

/** Lightweight pentagon radar chart, no external chart library needed. */
export function ScoreRadarChart({ scores, size = 220 }: ScoreRadarChartProps) {
  const center = size / 2;
  const radius = size / 2 - 28;
  const angleStep = (Math.PI * 2) / scores.length;
  const startAngle = -Math.PI / 2;

  function pointFor(index: number, value: number) {
    const angle = startAngle + angleStep * index;
    const r = (Math.max(0, Math.min(100, value)) / 100) * radius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  }

  const polygonPoints = scores.map((score, index) => pointFor(index, score.value)).map((p) => `${p.x},${p.y}`).join(" ");
  const ringLevels = [25, 50, 75, 100];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="mx-auto">
      {ringLevels.map((level) => {
        const points = scores.map((_, index) => pointFor(index, level)).map((p) => `${p.x},${p.y}`).join(" ");
        return <polygon key={level} points={points} fill="none" stroke="#334155" strokeWidth={1} />;
      })}
      {scores.map((score, index) => {
        const outer = pointFor(index, 100);
        return <line key={score.label} x1={center} y1={center} x2={outer.x} y2={outer.y} stroke="#334155" strokeWidth={1} />;
      })}
      <polygon points={polygonPoints} fill="#67e8f9" fillOpacity={0.25} stroke="#67e8f9" strokeWidth={2} />
      {scores.map((score, index) => {
        const labelPoint = pointFor(index, 118);
        return (
          <text
            key={score.label}
            x={labelPoint.x}
            y={labelPoint.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={11}
            fill="#cbd5e1"
          >
            {score.label}
          </text>
        );
      })}
    </svg>
  );
}
