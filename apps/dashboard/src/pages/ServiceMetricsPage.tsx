import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCurrentUser, isAuthenticated, logout } from '../services/auth';
import {
  AlertRule,
  AlertOperator,
  createAlertRule,
  getAlertRules,
  getProjectDetails,
  getRequestMetrics,
  getSystemMetrics,
  RequestMetricPoint,
  setProjectSlackWebhook,
  SystemMetricPoint,
  updateAlertRule,
} from '../services/project';

type TabType = 'system' | 'request' | 'alert';
type TimeWindow = 'minutes' | 'hours' | 'day';

const ALERT_OPERATORS: AlertOperator[] = ['>', '<'];
const ALERT_WINDOW_OPTIONS = [
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: '10 minutes', value: 600 },
  { label: '30 minutes', value: 1800 },
  { label: '1 hour', value: 3600 },
];

const SYSTEM_ALERT_METRICS = [
  { label: 'avgCpu', value: 'avgCpu' },
  { label: 'avgMemoryMb', value: 'avgMemoryMb' },
] as const;

const REQUEST_ALERT_METRICS = [
  { label: 'errorRate', value: 'errorRate' },
  { label: 'avgLatencyMs', value: 'avgLatencyMs' },
] as const;

type SystemAlertMetricField = (typeof SYSTEM_ALERT_METRICS)[number]['value'];
type RequestAlertMetricField = (typeof REQUEST_ALERT_METRICS)[number]['value'];
type AlertMetricField = SystemAlertMetricField | RequestAlertMetricField;

type ThresholdConfig = {
  unit: string;
  min: number;
  max?: number;
  step: number;
};

function getThresholdConfig(metricField: string): ThresholdConfig {
  if (metricField === 'avgCpu' || metricField === 'errorRate') {
    return { unit: '%', min: 0.1, max: 100, step: 0.1 };
  }

  if (metricField === 'avgMemoryMb') {
    return { unit: 'MB', min: 0, step: 1 };
  }

  if (metricField === 'avgLatencyMs') {
    return { unit: 'ms', min: 0, step: 1 };
  }

  return { unit: '', min: 0, step: 1 };
}

function normalizeThreshold(value: number, metricField: string): number {
  const config = getThresholdConfig(metricField);

  if (!Number.isFinite(value)) {
    return config.min;
  }

  let normalized = Math.max(config.min, value);
  if (config.max !== undefined) {
    normalized = Math.min(config.max, normalized);
  }

  return normalized;
}

type UnitType = 'ms' | 'percent' | 'requests' | 'mb';

type TimeSeriesPoint = {
  ts: number;
  value: number | null;
  secondaryValue?: number | null;
  tertiaryValue?: number | null;
  compareValue?: number | null;
  compareSecondaryValue?: number | null;
  compareTertiaryValue?: number | null;
};

const TIME_WINDOW_CONFIG: Record<TimeWindow, { label: string; windowMs: number; subtitle: string }> = {
  minutes: { label: 'Minutes', windowMs: 60 * 60 * 1000, subtitle: 'Last 60 minutes' },
  hours: { label: 'Hours', windowMs: 48 * 60 * 60 * 1000, subtitle: 'Last 48 hours' },
  day: { label: 'Day', windowMs: 30 * 24 * 60 * 60 * 1000, subtitle: 'Last 30 days' },
};

type EndpointAggregate = {
  key: string;
  method: string;
  route: string;
  totalRequests: number;
  successCount: number;
  clientErrorCount: number;
  serverErrorCount: number;
  avgResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
};

const CHART_WIDTH = 820;
const CHART_HEIGHT = 280;
const CHART_PADDING_TOP = 16;
const CHART_PADDING_RIGHT = 16;
const CHART_PADDING_BOTTOM = 40;
const CHART_PADDING_LEFT = 64;

function getBucketIntervalMs(timeWindow: TimeWindow): number {
  if (timeWindow === 'minutes') {
    return 60 * 1000;
  }

  if (timeWindow === 'hours') {
    return 60 * 60 * 1000;
  }

  return 24 * 60 * 60 * 1000;
}

function buildExpectedBuckets(from: number, to: number, bucketMs: number): number[] {
  if (!Number.isFinite(from) || !Number.isFinite(to) || bucketMs <= 0 || from > to) {
    return [];
  }

  const start = Math.floor(from / bucketMs) * bucketMs;
  const end = Math.floor(to / bucketMs) * bucketMs;
  const buckets: number[] = [];

  for (let ts = start; ts <= end; ts += bucketMs) {
    buckets.push(ts);
  }

  return buckets;
}

function toNumberBucket(value: string | number | undefined): number {
  return typeof value === 'string' ? Number(value) : value ?? 0;
}

function formatBucketLabel(ts: number, timeWindow: TimeWindow): string {
  if (!Number.isFinite(ts) || ts <= 0) {
    return '-';
  }

  if (timeWindow === 'minutes') {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  if (timeWindow === 'hours') {
    return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' });
  }

  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatXAxisTick(ts: number, timeWindow: TimeWindow): string {
  if (!Number.isFinite(ts) || ts <= 0) {
    return '-';
  }

  if (timeWindow === 'minutes') {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  if (timeWindow === 'hours') {
    return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', hour12: false });
  }

  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatValue(value: number, unit: UnitType, precise = false): string {
  if (unit === 'ms') {
    if (precise) {
      return `${value.toFixed(2)} ms`;
    }
    return value >= 100 ? `${Math.round(value)} ms` : `${value.toFixed(1)} ms`;
  }

  if (unit === 'percent') {
    return `${(precise ? value.toFixed(2) : value.toFixed(1))}%`;
  }

  if (unit === 'mb') {
    if (precise) {
      return `${value.toFixed(2)} MB`;
    }
    return value >= 100 ? `${Math.round(value)} MB` : `${value.toFixed(1)} MB`;
  }

  return precise ? `${value.toFixed(2)}` : `${Math.round(value).toLocaleString()}`;
}

function getTickIntervalMs(timeWindow: TimeWindow, from: number, to: number): number {
  const range = Math.max(to - from, 1);

  const candidates =
    timeWindow === 'minutes'
      ? [60 * 1000, 2 * 60 * 1000, 5 * 60 * 1000, 10 * 60 * 1000, 15 * 60 * 1000]
      : timeWindow === 'hours'
        ? [60 * 60 * 1000, 2 * 60 * 60 * 1000, 3 * 60 * 60 * 1000, 6 * 60 * 60 * 1000, 12 * 60 * 60 * 1000]
        : [24 * 60 * 60 * 1000, 2 * 24 * 60 * 60 * 1000, 3 * 24 * 60 * 60 * 1000, 5 * 24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000];

  const maxTicks = 8;
  for (const candidate of candidates) {
    if (range / candidate <= maxTicks) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1];
}

function buildXAxisTicks(timeWindow: TimeWindow, from: number, to: number): number[] {
  const tickMs = getTickIntervalMs(timeWindow, from, to);
  const start = Math.ceil(from / tickMs) * tickMs;
  const ticks: number[] = [];

  for (let ts = start; ts <= to; ts += tickMs) {
    ticks.push(ts);
  }

  if (ticks.length === 0) {
    ticks.push(from, to);
  }

  return ticks;
}

function niceStep(rawStep: number): number {
  if (rawStep <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(rawStep));
  const fraction = rawStep / 10 ** exponent;

  if (fraction <= 1) return 1 * 10 ** exponent;
  if (fraction <= 2) return 2 * 10 ** exponent;
  if (fraction <= 5) return 5 * 10 ** exponent;
  return 10 * 10 ** exponent;
}

function buildNiceYAxis(
  values: number[],
  mode: 'auto' | 'percent' | 'uptime',
  unit: UnitType,
  startAtZero = false
): { min: number; max: number; ticks: number[] } {
  if (mode === 'percent') {
    return { min: 0, max: 100, ticks: [0, 20, 40, 60, 80, 100] };
  }

  if (mode === 'uptime') {
    const observedMin = values.length ? Math.min(...values) : 99;
    const min = observedMin < 95 ? Math.floor(observedMin) : 95;
    const max = 100;
    const step = observedMin < 95 ? 1 : 0.5;
    const ticks: number[] = [];
    for (let tick = min; tick <= max + 1e-9; tick += step) {
      ticks.push(Number(tick.toFixed(2)));
    }
    return { min, max, ticks };
  }

  if (!values.length) {
    return { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };
  }

  let rawMin = Math.min(...values);
  let rawMax = Math.max(...values);

  if (rawMin === rawMax) {
    const delta = rawMax === 0 ? 1 : Math.abs(rawMax) * 0.2;
    rawMin -= delta;
    rawMax += delta;
  }

  const range = rawMax - rawMin;
  const paddedMax = rawMax + range * 0.15;
  let paddedMin = rawMin - range * 0.1;

  if (startAtZero || unit === 'requests') {
    paddedMin = 0;
  }

  if (!startAtZero && unit !== 'requests' && rawMin >= 0) {
    paddedMin = Math.max(0, paddedMin);
  }

  const targetTicks = 6;
  const step = niceStep((paddedMax - paddedMin) / (targetTicks - 1));
  const min = Math.floor(paddedMin / step) * step;
  const max = Math.ceil(paddedMax / step) * step;

  const ticks: number[] = [];
  for (let tick = min; tick <= max + 1e-9; tick += step) {
    ticks.push(Number(tick.toFixed(6)));
  }

  return { min, max, ticks };
}

const VolumeTimeChart: React.FC<{
  title: string;
  yLabel: string;
  unit: UnitType;
  points: TimeSeriesPoint[];
  timeWindow: TimeWindow;
  from: number;
  to: number;
  tone?: 'primary' | 'ink';
  chartType?: 'line' | 'area';
  yMode?: 'auto' | 'percent' | 'uptime';
  yStartAtZero?: boolean;
  showSecondaryLine?: boolean;
  secondaryLabel?: string;
  showTertiaryLine?: boolean;
  tertiaryLabel?: string;
  thresholdLine?: { value: number; label: string };
  shadeAboveThreshold?: boolean;
  thresholdCapacityLabel?: string;
  thresholdAffectsSeriesColor?: boolean;
  tooltipTotalLabel?: string;
  showPeakMarker?: boolean;
  peakLabelPrefix?: string;
}> = ({
  title,
  yLabel,
  unit,
  points,
  timeWindow,
  from,
  to,
  tone = 'primary',
  chartType = 'line',
  yMode = 'auto',
  yStartAtZero = false,
  showSecondaryLine = false,
  secondaryLabel = 'Secondary',
  showTertiaryLine = false,
  tertiaryLabel = 'Tertiary',
  thresholdLine,
  shadeAboveThreshold = false,
  thresholdCapacityLabel,
  thresholdAffectsSeriesColor = false,
  tooltipTotalLabel,
  showPeakMarker = false,
  peakLabelPrefix = 'Peak',
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panRatio, setPanRatio] = useState<number>(1);

  const clampZoom = (value: number) => {
    return Math.max(1, Math.min(8, value));
  };

  useEffect(() => {
    setZoomLevel(1);
    setPanRatio(1);
    setHoveredIndex(null);
  }, [from, to, timeWindow]);

  const totalSpan = Math.max(to - from, 1);
  const visibleSpan = Math.max(totalSpan / clampZoom(zoomLevel), 1);
  const maxPanOffset = Math.max(totalSpan - visibleSpan, 0);
  const visibleFrom = from + maxPanOffset * panRatio;
  const effectiveVisibleTo = visibleFrom + visibleSpan;
  const xRange = Math.max(effectiveVisibleTo - visibleFrom, 1);
  const plotWidth = CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
  const plotHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

  const visiblePoints = useMemo(() => {
    return points.filter((point) => point.ts >= visibleFrom && point.ts <= effectiveVisibleTo);
  }, [points, visibleFrom, effectiveVisibleTo]);

  const xTicks = useMemo(
    () => buildXAxisTicks(timeWindow, visibleFrom, effectiveVisibleTo),
    [timeWindow, visibleFrom, effectiveVisibleTo]
  );

  const yAxis = useMemo(() => {
    const values = visiblePoints
      .flatMap((point) => [
        point.value,
        showSecondaryLine ? point.secondaryValue ?? null : null,
        showTertiaryLine ? point.tertiaryValue ?? null : null,
      ])
      .filter((value): value is number => value !== null && Number.isFinite(value));

    if (thresholdLine && Number.isFinite(thresholdLine.value)) {
      values.push(thresholdLine.value);
    }

    return buildNiceYAxis(values, yMode, unit, yStartAtZero);
  }, [visiblePoints, showSecondaryLine, showTertiaryLine, thresholdLine, yMode, unit, yStartAtZero]);

  const mapX = (ts: number) => {
    return CHART_PADDING_LEFT + ((ts - visibleFrom) / xRange) * plotWidth;
  };

  const mapY = (value: number) => {
    const normalized = (value - yAxis.min) / Math.max(yAxis.max - yAxis.min, 1e-9);
    return CHART_PADDING_TOP + plotHeight - normalized * plotHeight;
  };

  const buildLinePath = (selector: (point: TimeSeriesPoint) => number | null | undefined): string => {
    let path = '';
    let segmentOpen = false;

    visiblePoints.forEach((point) => {
      const value = selector(point);
      if (value === null || value === undefined || !Number.isFinite(value)) {
        segmentOpen = false;
        return;
      }

      const x = mapX(point.ts);
      const y = mapY(value);

      if (!segmentOpen) {
        path += ` M ${x} ${y}`;
        segmentOpen = true;
      } else {
        path += ` L ${x} ${y}`;
      }
    });

    return path.trim();
  };

  const buildThresholdHighlightPath = (
    selector: (point: TimeSeriesPoint) => number | null | undefined,
    threshold: number
  ): string => {
    type SegmentPoint = { x: number; value: number };
    const series: SegmentPoint[] = visiblePoints
      .map((point) => {
        const value = selector(point);
        if (value === null || value === undefined || !Number.isFinite(value)) {
          return null;
        }
        return { x: mapX(point.ts), value };
      })
      .filter((point): point is SegmentPoint => point !== null);

    if (series.length < 2) {
      return '';
    }

    let path = '';

    for (let i = 1; i < series.length; i += 1) {
      const prev = series[i - 1];
      const curr = series[i];
      const prevAbove = prev.value > threshold;
      const currAbove = curr.value > threshold;

      if (prevAbove && currAbove) {
        path += ` M ${prev.x} ${mapY(prev.value)} L ${curr.x} ${mapY(curr.value)}`;
        continue;
      }

      if (prevAbove === currAbove) {
        continue;
      }

      const span = curr.value - prev.value;
      if (Math.abs(span) < 1e-9) {
        continue;
      }

      const ratio = (threshold - prev.value) / span;
      const crossingX = prev.x + ratio * (curr.x - prev.x);
      const crossingY = mapY(threshold);

      if (prevAbove && !currAbove) {
        path += ` M ${prev.x} ${mapY(prev.value)} L ${crossingX} ${crossingY}`;
      } else if (!prevAbove && currAbove) {
        path += ` M ${crossingX} ${crossingY} L ${curr.x} ${mapY(curr.value)}`;
      }
    }

    return path.trim();
  };

  const buildAreaPath = (selector: (point: TimeSeriesPoint) => number | null | undefined): string => {
    const baselineY = mapY(yAxis.min);
    let path = '';
    let segment: Array<{ x: number; y: number }> = [];

    const flush = () => {
      if (!segment.length) {
        return;
      }

      const first = segment[0];
      const last = segment[segment.length - 1];

      path += ` M ${first.x} ${baselineY}`;
      segment.forEach((point, index) => {
        path += `${index === 0 ? ' L' : ' L'} ${point.x} ${point.y}`;
      });
      path += ` L ${last.x} ${baselineY} Z`;
      segment = [];
    };

    visiblePoints.forEach((point) => {
      const value = selector(point);
      if (value === null || value === undefined || !Number.isFinite(value)) {
        flush();
        return;
      }

      segment.push({ x: mapX(point.ts), y: mapY(value) });
    });

    flush();
    return path.trim();
  };

  const primaryPath = useMemo(
    () => buildLinePath((point) => point.value),
    [visiblePoints, yAxis.min, yAxis.max, visibleFrom, effectiveVisibleTo]
  );
  const secondaryPath = useMemo(
    () => (showSecondaryLine ? buildLinePath((point) => point.secondaryValue) : ''),
    [visiblePoints, yAxis.min, yAxis.max, visibleFrom, effectiveVisibleTo, showSecondaryLine]
  );
  const tertiaryPath = useMemo(
    () => (showTertiaryLine ? buildLinePath((point) => point.tertiaryValue) : ''),
    [visiblePoints, yAxis.min, yAxis.max, visibleFrom, effectiveVisibleTo, showTertiaryLine]
  );
  const primaryAreaPath = useMemo(
    () => (chartType === 'area' ? buildAreaPath((point) => point.value) : ''),
    [chartType, visiblePoints, yAxis.min, yAxis.max, visibleFrom, effectiveVisibleTo]
  );
  const comparePrimaryPath = useMemo(
    () => buildLinePath((point) => point.compareValue),
    [visiblePoints, yAxis.min, yAxis.max, visibleFrom, effectiveVisibleTo]
  );
  const compareSecondaryPath = useMemo(
    () => (showSecondaryLine ? buildLinePath((point) => point.compareSecondaryValue) : ''),
    [visiblePoints, yAxis.min, yAxis.max, visibleFrom, effectiveVisibleTo, showSecondaryLine]
  );
  const compareTertiaryPath = useMemo(
    () => (showTertiaryLine ? buildLinePath((point) => point.compareTertiaryValue) : ''),
    [visiblePoints, yAxis.min, yAxis.max, visibleFrom, effectiveVisibleTo, showTertiaryLine]
  );

  const primaryTone = tone === 'primary' ? 'rgba(27,77,62,0.9)' : 'rgba(15,23,42,0.9)';
  const secondaryTone = 'rgba(27,77,62,0.75)';
  const tertiaryTone = 'rgba(220,38,38,0.95)';
  const thresholdTone = 'rgba(220,38,38,0.7)';

  const hasCompareData = useMemo(
    () =>
      visiblePoints.some(
        (point) =>
          Number.isFinite(point.compareValue ?? Number.NaN) ||
          Number.isFinite(point.compareSecondaryValue ?? Number.NaN) ||
          Number.isFinite(point.compareTertiaryValue ?? Number.NaN)
      ),
    [visiblePoints]
  );

  const primaryThresholdPath = useMemo(
    () =>
      thresholdAffectsSeriesColor && thresholdLine && Number.isFinite(thresholdLine.value)
        ? buildThresholdHighlightPath((point) => point.value, thresholdLine.value)
        : '',
    [thresholdAffectsSeriesColor, thresholdLine, visiblePoints, yAxis.min, yAxis.max, visibleFrom, effectiveVisibleTo]
  );
  const secondaryThresholdPath = useMemo(
    () =>
      thresholdAffectsSeriesColor && thresholdLine && Number.isFinite(thresholdLine.value)
        ? buildThresholdHighlightPath((point) => point.secondaryValue, thresholdLine.value)
        : '',
    [thresholdAffectsSeriesColor, thresholdLine, visiblePoints, yAxis.min, yAxis.max, visibleFrom, effectiveVisibleTo]
  );
  const tertiaryThresholdPath = useMemo(
    () =>
      thresholdAffectsSeriesColor && thresholdLine && Number.isFinite(thresholdLine.value)
        ? buildThresholdHighlightPath((point) => point.tertiaryValue, thresholdLine.value)
        : '',
    [thresholdAffectsSeriesColor, thresholdLine, visiblePoints, yAxis.min, yAxis.max, visibleFrom, effectiveVisibleTo]
  );

  const peakPoint = useMemo<TimeSeriesPoint | null>(() => {
    if (!showPeakMarker) {
      return null;
    }

    let result: TimeSeriesPoint | null = null;
    visiblePoints.forEach((point) => {
      if (point.value === null || point.value === undefined) {
        return;
      }

      if (!result || (result.value !== null && result.value !== undefined && point.value > result.value)) {
        result = point;
      }
    });

    return result;
  }, [showPeakMarker, visiblePoints]);

  const hoveredPoint = hoveredIndex !== null ? visiblePoints[hoveredIndex] : null;

  return (
    <div className="bg-white border-2 border-ink p-5 shadow-hard">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-ink/70">{title}</p>
          <p className="text-base font-mono text-ink/70 mt-1">{yLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {(showSecondaryLine || showTertiaryLine) && (
            <p className="text-sm font-mono text-ink/70">
              Lines: {showSecondaryLine ? secondaryLabel : ''}
              {showSecondaryLine && showTertiaryLine ? ', ' : ''}
              {showTertiaryLine ? tertiaryLabel : ''}
            </p>
          )}
          {hasCompareData && <p className="text-sm font-mono text-ink/70">Dashed: previous window</p>}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-ink/70">Zoom</span>
            <input
              type="range"
              min={1}
              max={8}
              step={0.25}
              value={zoomLevel}
              onChange={(event) => setZoomLevel(clampZoom(Number(event.target.value)))}
              className="w-32"
            />
            <span className="font-mono text-ink min-w-[40px] text-right">{zoomLevel.toFixed(2)}x</span>
          </div>
        </div>
      </div>

      {visiblePoints.length === 0 ? (
        <div className="h-64 border-2 border-dashed border-ink/30 flex items-center justify-center text-sm text-ink/60">
          No data points in selected range.
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="w-full h-64 border-2 border-ink bg-paper"
            onMouseLeave={() => setHoveredIndex(null)}
            onMouseMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const xRatio = (event.clientX - rect.left) / rect.width;
              const x = CHART_WIDTH * xRatio;

              let nearestIndex = 0;
              let nearestDistance = Number.POSITIVE_INFINITY;

              visiblePoints.forEach((point, idx) => {
                const px = mapX(point.ts);
                const distance = Math.abs(px - x);
                if (distance < nearestDistance) {
                  nearestDistance = distance;
                  nearestIndex = idx;
                }
              });

              setHoveredIndex(nearestIndex);
            }}
            onWheel={(event) => {
              event.preventDefault();
              setZoomLevel((current) => {
                const next = event.deltaY < 0 ? current + 0.25 : current - 0.25;
                return clampZoom(Number(next.toFixed(2)));
              });
            }}
          >
            {yAxis.ticks.map((tick) => (
              <g key={`y-${tick}`}>
                <line
                  x1={CHART_PADDING_LEFT}
                  x2={CHART_WIDTH - CHART_PADDING_RIGHT}
                  y1={mapY(tick)}
                  y2={mapY(tick)}
                  stroke="rgba(15,23,42,0.12)"
                  strokeWidth="1"
                />
                <text
                  x={CHART_PADDING_LEFT - 8}
                  y={mapY(tick) + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="rgba(15,23,42,0.7)"
                >
                  {formatValue(tick, unit)}
                </text>
              </g>
            ))}

            {xTicks.map((tick) => (
              <g key={`x-${tick}`}>
                <line
                  x1={mapX(tick)}
                  x2={mapX(tick)}
                  y1={CHART_PADDING_TOP}
                  y2={CHART_HEIGHT - CHART_PADDING_BOTTOM}
                  stroke="rgba(15,23,42,0.08)"
                  strokeWidth="1"
                />
                <text
                  x={mapX(tick)}
                  y={CHART_HEIGHT - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fill="rgba(15,23,42,0.7)"
                >
                  {formatXAxisTick(tick, timeWindow)}
                </text>
              </g>
            ))}

            {thresholdLine && shadeAboveThreshold && Number.isFinite(thresholdLine.value) && (
              <rect
                x={CHART_PADDING_LEFT}
                y={CHART_PADDING_TOP}
                width={CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT}
                height={Math.max(0, mapY(thresholdLine.value) - CHART_PADDING_TOP)}
                fill="rgba(220,38,38,0.1)"
              />
            )}

            {chartType === 'area' && primaryAreaPath && <path d={primaryAreaPath} fill="rgba(27,77,62,0.2)" stroke="none" />}

            {primaryPath && <path d={primaryPath} fill="none" stroke={primaryTone} strokeWidth="2.5" />}
            {primaryThresholdPath && <path d={primaryThresholdPath} fill="none" stroke={tertiaryTone} strokeWidth="2.5" />}

            {hasCompareData && comparePrimaryPath && (
              <path
                d={comparePrimaryPath}
                fill="none"
                stroke={tone === 'primary' ? 'rgba(27,77,62,0.38)' : 'rgba(15,23,42,0.38)'}
                strokeWidth="2"
                strokeDasharray="6 4"
              />
            )}

            {showSecondaryLine && secondaryPath && (
              <path d={secondaryPath} fill="none" stroke={secondaryTone} strokeWidth="2" strokeDasharray="4 3" />
            )}
            {showSecondaryLine && secondaryThresholdPath && (
              <path d={secondaryThresholdPath} fill="none" stroke={tertiaryTone} strokeWidth="2" strokeDasharray="4 3" />
            )}
            {showSecondaryLine && hasCompareData && compareSecondaryPath && (
              <path d={compareSecondaryPath} fill="none" stroke="rgba(27,77,62,0.35)" strokeWidth="1.75" strokeDasharray="6 4" />
            )}

            {showTertiaryLine && tertiaryPath && (
              <path d={tertiaryPath} fill="none" stroke={secondaryTone} strokeWidth="2" strokeDasharray="2 3" />
            )}
            {showTertiaryLine && tertiaryThresholdPath && (
              <path d={tertiaryThresholdPath} fill="none" stroke={tertiaryTone} strokeWidth="2" strokeDasharray="2 3" />
            )}
            {showTertiaryLine && hasCompareData && compareTertiaryPath && (
              <path d={compareTertiaryPath} fill="none" stroke="rgba(220,38,38,0.4)" strokeWidth="1.75" strokeDasharray="6 4" />
            )}

            {peakPoint && peakPoint.value !== null && peakPoint.value !== undefined && (
              <g>
                <circle cx={mapX(peakPoint.ts)} cy={mapY(peakPoint.value)} r="4" fill={tertiaryTone} />
                <text
                  x={mapX(peakPoint.ts)}
                  y={Math.max(CHART_PADDING_TOP + 10, mapY(peakPoint.value) - 10)}
                  textAnchor="middle"
                  fontSize="10"
                  fill="rgba(15,23,42,0.95)"
                  fontWeight="700"
                >
                  {`${peakLabelPrefix}: ${formatValue(peakPoint.value, unit, true)}`}
                </text>
              </g>
            )}

            {thresholdLine && Number.isFinite(thresholdLine.value) && (
              <g>
                <line
                  x1={CHART_PADDING_LEFT}
                  x2={CHART_WIDTH - CHART_PADDING_RIGHT}
                  y1={mapY(thresholdLine.value)}
                  y2={mapY(thresholdLine.value)}
                  stroke={thresholdTone}
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
                <text
                  x={CHART_WIDTH - CHART_PADDING_RIGHT - 4}
                  y={mapY(thresholdLine.value) - 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="rgba(220,38,38,0.95)"
                >
                  {thresholdCapacityLabel ? `${thresholdLine.label} · ${thresholdCapacityLabel}` : thresholdLine.label}
                </text>
              </g>
            )}

            {hoveredPoint && (
              <line
                x1={mapX(hoveredPoint.ts)}
                x2={mapX(hoveredPoint.ts)}
                y1={CHART_PADDING_TOP}
                y2={CHART_HEIGHT - CHART_PADDING_BOTTOM}
                stroke="rgba(15,23,42,0.4)"
                strokeWidth="1"
              />
            )}
          </svg>

          <div className="mt-3 px-1">
            <div className="flex items-center gap-3 text-xs font-mono text-ink/70">
              <span className="min-w-[32px]">Pan</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={panRatio}
                onChange={(event) => setPanRatio(Number(event.target.value))}
                className="w-full"
                disabled={zoomLevel <= 1}
              />
              <span className="min-w-[44px] text-right">{Math.round(panRatio * 100)}%</span>
            </div>
          </div>

          {hoveredPoint && (
            <div className="absolute top-2 left-2 bg-white border-2 border-ink px-3 py-2 text-xs font-mono shadow-hard-sm z-10">
              <div className="font-bold text-ink">{new Date(hoveredPoint.ts).toLocaleString()}</div>
              <div className="text-ink/70">
                {tooltipTotalLabel || 'Value'}: {hoveredPoint.value === null ? 'N/A' : formatValue(hoveredPoint.value, unit, true)}
              </div>
              {showSecondaryLine && hoveredPoint.secondaryValue !== null && hoveredPoint.secondaryValue !== undefined && (
                <div className="text-ink/70">
                  {secondaryLabel}: {formatValue(hoveredPoint.secondaryValue, unit, true)}
                </div>
              )}
              {showTertiaryLine && hoveredPoint.tertiaryValue !== null && hoveredPoint.tertiaryValue !== undefined && (
                <div className="text-red-700">
                  {tertiaryLabel}: {formatValue(hoveredPoint.tertiaryValue, unit, true)}
                </div>
              )}
              {hoveredPoint.compareValue !== null && hoveredPoint.compareValue !== undefined && (
                <div className="text-ink/60">Prev {tooltipTotalLabel || 'Value'}: {formatValue(hoveredPoint.compareValue, unit, true)}</div>
              )}
              {showSecondaryLine && hoveredPoint.compareSecondaryValue !== null && hoveredPoint.compareSecondaryValue !== undefined && (
                <div className="text-ink/60">Prev {secondaryLabel}: {formatValue(hoveredPoint.compareSecondaryValue, unit, true)}</div>
              )}
              {showTertiaryLine && hoveredPoint.compareTertiaryValue !== null && hoveredPoint.compareTertiaryValue !== undefined && (
                <div className="text-ink/60">Prev {tertiaryLabel}: {formatValue(hoveredPoint.compareTertiaryValue, unit, true)}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ServiceMetricsPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectId, serviceName } = useParams<{ projectId: string; serviceName: string }>();
  const user = getCurrentUser();
  const decodedServiceName = decodeURIComponent(serviceName || '');

  const [activeTab, setActiveTab] = useState<TabType>('system');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [systemMetrics, setSystemMetrics] = useState<SystemMetricPoint[]>([]);
  const [requestMetrics, setRequestMetrics] = useState<RequestMetricPoint[]>([]);
  const [previousRequestMetrics, setPreviousRequestMetrics] = useState<RequestMetricPoint[]>([]);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('hours');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [endpointFilter, setEndpointFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<{ from: number; to: number }>(() => {
    const to = Date.now();
    return { from: to - TIME_WINDOW_CONFIG.hours.windowMs, to };
  });
  const [showP95Line, setShowP95Line] = useState(true);
  const [showErrorThreshold, setShowErrorThreshold] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [latencyThresholdMs, setLatencyThresholdMs] = useState(700);
  const [errorThresholdPercent, setErrorThresholdPercent] = useState(5);
  const [projectSlackWebhookUrl, setProjectSlackWebhookUrl] = useState('');
  const [pendingWebhookUrl, setPendingWebhookUrl] = useState('');
  const [systemMetricField, setSystemMetricField] = useState<SystemAlertMetricField>('avgCpu');
  const [systemOperator, setSystemOperator] = useState<AlertOperator>('>');
  const [systemThreshold, setSystemThreshold] = useState(80);
  const [systemWindowSec, setSystemWindowSec] = useState(300);
  const [requestMetricField, setRequestMetricField] = useState<RequestAlertMetricField>('errorRate');
  const [requestOperator, setRequestOperator] = useState<AlertOperator>('>');
  const [requestThreshold, setRequestThreshold] = useState(5);
  const [requestWindowSec, setRequestWindowSec] = useState(300);
  const [requestEndpointRule, setRequestEndpointRule] = useState('all');
  const [isAlertSubmitting, setIsAlertSubmitting] = useState(false);
  const [alertSuccess, setAlertSuccess] = useState('');
  const [alertError, setAlertError] = useState('');
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [isAlertRulesLoading, setIsAlertRulesLoading] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingRuleMetricField, setEditingRuleMetricField] = useState<AlertMetricField>('avgCpu');
  const [editingThreshold, setEditingThreshold] = useState(0);
  const [editingWindowSec, setEditingWindowSec] = useState(300);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/');
      return;
    }

    if (!projectId || !decodedServiceName) {
      navigate('/home');
      return;
    }

    loadMetrics();
  }, [navigate, projectId, decodedServiceName, timeWindow, compareMode]);

  const loadMetrics = async () => {
    if (!projectId || !decodedServiceName) return;

    try {
      setLoading(true);
      setError('');

      const to = Date.now();
      const from = to - TIME_WINDOW_CONFIG[timeWindow].windowMs;
      setTimeRange({ from, to });

      const windowMs = TIME_WINDOW_CONFIG[timeWindow].windowMs;
      const previousFrom = from - windowMs;
      const previousTo = to - windowMs;

      const [systemData, requestData, previousRequestData] = await Promise.all([
        getSystemMetrics(projectId, decodedServiceName, from, to),
        getRequestMetrics(projectId, decodedServiceName, from, to),
        compareMode ? getRequestMetrics(projectId, decodedServiceName, previousFrom, previousTo) : Promise.resolve([]),
      ]);

      setSystemMetrics(systemData || []);
      setRequestMetrics(requestData || []);
      setPreviousRequestMetrics(previousRequestData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load service metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const loadAlertRules = async () => {
    if (!projectId || !decodedServiceName) {
      return;
    }

    try {
      setIsAlertRulesLoading(true);
      const rules = await getAlertRules(projectId, decodedServiceName);
      setAlertRules(rules || []);
    } catch (err: any) {
      setAlertError(err.message || 'Failed to fetch alert rules');
    } finally {
      setIsAlertRulesLoading(false);
    }
  };

  const loadProjectWebhook = async () => {
    if (!projectId) {
      return;
    }

    try {
      const project = await getProjectDetails(projectId);
      const webhook = (project as any).slackWebhookUrl || '';
      setProjectSlackWebhookUrl(webhook);
    } catch (err: any) {
      setAlertError(err.message || 'Failed to fetch project webhook');
    }
  };

  const saveProjectWebhook = async () => {
    if (!projectId || !pendingWebhookUrl.trim()) {
      return;
    }

    try {
      setIsAlertSubmitting(true);
      setAlertError('');
      setAlertSuccess('');

      const updatedProject = await setProjectSlackWebhook(projectId, pendingWebhookUrl.trim());
      setProjectSlackWebhookUrl((updatedProject as any).slackWebhookUrl || pendingWebhookUrl.trim());
      setPendingWebhookUrl('');
      setAlertSuccess('Project Slack webhook saved successfully.');
    } catch (err: any) {
      setAlertError(err.message || 'Failed to save project Slack webhook');
    } finally {
      setIsAlertSubmitting(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'alert') {
      loadAlertRules();
      loadProjectWebhook();
    }
  }, [activeTab, projectId, decodedServiceName]);

  const beginEditRule = (rule: AlertRule) => {
    setEditingRuleId(rule.id);
    setEditingRuleMetricField(rule.metricField as AlertMetricField);
    setEditingThreshold(rule.threshold);
    setEditingWindowSec(rule.windowSec);
    setAlertError('');
    setAlertSuccess('');
  };

  const saveEditedRule = async () => {
    if (!editingRuleId) {
      return;
    }

    if (!projectSlackWebhookUrl.trim()) {
      setAlertError('Set project Slack webhook first.');
      return;
    }

    try {
      setIsAlertSubmitting(true);
      setAlertError('');
      setAlertSuccess('');

      await updateAlertRule(editingRuleId, {
        threshold: normalizeThreshold(editingThreshold, editingRuleMetricField),
        windowSec: editingWindowSec,
      });

      setAlertSuccess('Alert rule updated successfully.');
      setEditingRuleId(null);
      await loadAlertRules();
    } catch (err: any) {
      setAlertError(err.message || 'Failed to update alert rule');
    } finally {
      setIsAlertSubmitting(false);
    }
  };

  const createSystemAlertRule = async () => {
    if (!projectId || !decodedServiceName) {
      return;
    }

    if (!projectSlackWebhookUrl.trim()) {
      setAlertError('Set project Slack webhook first.');
      return;
    }

    try {
      setIsAlertSubmitting(true);
      setAlertError('');
      setAlertSuccess('');

      await createAlertRule({
        projectId,
        serviceName: decodedServiceName,
        metricType: 'system',
        metricField: systemMetricField as any,
        operator: systemOperator,
        threshold: normalizeThreshold(systemThreshold, systemMetricField),
        windowSec: systemWindowSec,
      });

      setAlertSuccess('System alert rule created successfully.');
      await loadAlertRules();
    } catch (err: any) {
      setAlertError(err.message || 'Failed to create system alert rule');
    } finally {
      setIsAlertSubmitting(false);
    }
  };

  const createRequestAlertRule = async () => {
    if (!projectId || !decodedServiceName) {
      return;
    }

    if (!projectSlackWebhookUrl.trim()) {
      setAlertError('Set project Slack webhook first.');
      return;
    }

    try {
      setIsAlertSubmitting(true);
      setAlertError('');
      setAlertSuccess('');

      await createAlertRule({
        projectId,
        serviceName: decodedServiceName,
        metricType: 'request',
        metricField: requestMetricField as any,
        operator: requestOperator,
        threshold: normalizeThreshold(requestThreshold, requestMetricField),
        windowSec: requestWindowSec,
        endpoint: requestEndpointRule === 'all' ? undefined : requestEndpointRule,
      });

      setAlertSuccess('Request alert rule created successfully.');
      await loadAlertRules();
    } catch (err: any) {
      setAlertError(err.message || 'Failed to create request alert rule');
    } finally {
      setIsAlertSubmitting(false);
    }
  };

  const endpointAggregates = useMemo<EndpointAggregate[]>(() => {
    const grouped = new Map<string, EndpointAggregate & { weightedSum: number; p95Sum: number; p95Count: number }>();

    const source = requestMetrics.filter((metric) => {
      const methodOk = methodFilter === 'all' || metric.method === methodFilter;
      const endpointOk = endpointFilter === 'all' || metric.route === endpointFilter;
      return methodOk && endpointOk;
    });

    for (const metric of source) {
      const method = metric.method || 'GET';
      const route = metric.route || '/';
      const key = `${method} ${route}`;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          key,
          method,
          route,
          totalRequests: metric.totalRequests || 0,
          successCount: metric.successCount || 0,
          clientErrorCount: metric.clientErrorCount || 0,
          serverErrorCount: metric.serverErrorCount || 0,
          avgResponseTime: 0,
          maxResponseTime: metric.maxResponseTime || 0,
          p95ResponseTime: 0,
          weightedSum: (metric.avgResponseTime || 0) * (metric.totalRequests || 0),
          p95Sum: metric.p95ResponseTime || 0,
          p95Count: 1,
        });
      } else {
        existing.totalRequests += metric.totalRequests || 0;
        existing.successCount += metric.successCount || 0;
        existing.clientErrorCount += metric.clientErrorCount || 0;
        existing.serverErrorCount += metric.serverErrorCount || 0;
        existing.maxResponseTime = Math.max(existing.maxResponseTime, metric.maxResponseTime || 0);
        existing.weightedSum += (metric.avgResponseTime || 0) * (metric.totalRequests || 0);
        existing.p95Sum += metric.p95ResponseTime || 0;
        existing.p95Count += 1;
      }
    }

    return Array.from(grouped.values())
      .map((item) => ({
        key: item.key,
        method: item.method,
        route: item.route,
        totalRequests: item.totalRequests,
        successCount: item.successCount,
        clientErrorCount: item.clientErrorCount,
        serverErrorCount: item.serverErrorCount,
        avgResponseTime: item.totalRequests > 0 ? item.weightedSum / item.totalRequests : 0,
        maxResponseTime: item.maxResponseTime,
        p95ResponseTime: item.p95Count > 0 ? item.p95Sum / item.p95Count : 0,
      }))
      .sort((a, b) => b.totalRequests - a.totalRequests);
  }, [requestMetrics, methodFilter, endpointFilter]);

  const methodOptions = useMemo(() => {
    return Array.from(new Set(requestMetrics.map((metric) => metric.method).filter(Boolean))).sort();
  }, [requestMetrics]);

  const endpointOptions = useMemo(() => {
    const byMethod = requestMetrics.filter((metric) => methodFilter === 'all' || metric.method === methodFilter);
    return Array.from(new Set(byMethod.map((metric) => metric.route).filter(Boolean))).sort();
  }, [requestMetrics, methodFilter]);

  useEffect(() => {
    if (methodFilter !== 'all' && !methodOptions.includes(methodFilter)) {
      setMethodFilter('all');
    }
  }, [methodFilter, methodOptions]);

  useEffect(() => {
    if (endpointFilter !== 'all' && !endpointOptions.includes(endpointFilter)) {
      setEndpointFilter('all');
    }
  }, [endpointFilter, endpointOptions]);

  useEffect(() => {
    setSystemThreshold((prev) => normalizeThreshold(prev, systemMetricField));
  }, [systemMetricField]);

  useEffect(() => {
    setRequestThreshold((prev) => normalizeThreshold(prev, requestMetricField));
  }, [requestMetricField]);

  const expectedBuckets = useMemo(() => {
    return buildExpectedBuckets(timeRange.from, timeRange.to, getBucketIntervalMs(timeWindow));
  }, [timeRange.from, timeRange.to, timeWindow]);

  const systemCpuSeries = useMemo<TimeSeriesPoint[]>(() => {
    const byBucket = new Map<number, number>();
    systemMetrics.forEach((point) => {
      byBucket.set(toNumberBucket(point.bucket), point.avgCpu);
    });

    return expectedBuckets.map((ts) => ({
      ts,
      value: byBucket.get(ts) ?? null,
    }));
  }, [systemMetrics, expectedBuckets]);

  const systemMemorySeries = useMemo<TimeSeriesPoint[]>(() => {
    const byBucket = new Map<number, number>();
    systemMetrics.forEach((point) => {
      byBucket.set(toNumberBucket(point.bucket), point.avgMemoryMb);
    });

    return expectedBuckets.map((ts) => ({
      ts,
      value: byBucket.get(ts) ?? null,
    }));
  }, [systemMetrics, expectedBuckets]);

  const filteredRequestMetrics = useMemo(() => {
    return requestMetrics.filter((metric) => {
      const methodOk = methodFilter === 'all' || metric.method === methodFilter;
      const endpointOk = endpointFilter === 'all' || metric.route === endpointFilter;
      return methodOk && endpointOk;
    });
  }, [requestMetrics, methodFilter, endpointFilter]);

  const filteredPreviousRequestMetrics = useMemo(() => {
    return previousRequestMetrics.filter((metric) => {
      const methodOk = methodFilter === 'all' || metric.method === methodFilter;
      const endpointOk = endpointFilter === 'all' || metric.route === endpointFilter;
      return methodOk && endpointOk;
    });
  }, [previousRequestMetrics, methodFilter, endpointFilter]);

  const requestTimeline = useMemo(() => {
    const buildGroupedMap = (source: RequestMetricPoint[]) => {
      const grouped = new Map<
        number,
        {
          totalRequests: number;
          totalErrors: number;
          weightedLatencySum: number;
          weightedP95Sum: number;
          weightedP99Sum: number;
        }
      >();

      for (const point of source) {
        const bucket = toNumberBucket(point.minuteBucket ?? point.hourBucket ?? point.dayBucket);
        const existing = grouped.get(bucket);
        const totalRequests = point.totalRequests || 0;
        const totalErrors = (point.clientErrorCount || 0) + (point.serverErrorCount || 0);
        const p99ResponseTime = point.p99ResponseTime ?? point.maxResponseTime ?? point.p95ResponseTime ?? 0;

        if (!existing) {
          grouped.set(bucket, {
            totalRequests,
            totalErrors,
            weightedLatencySum: (point.avgResponseTime || 0) * totalRequests,
            weightedP95Sum: (point.p95ResponseTime || 0) * totalRequests,
            weightedP99Sum: (p99ResponseTime || 0) * totalRequests,
          });
        } else {
          existing.totalRequests += totalRequests;
          existing.totalErrors += totalErrors;
          existing.weightedLatencySum += (point.avgResponseTime || 0) * totalRequests;
          existing.weightedP95Sum += (point.p95ResponseTime || 0) * totalRequests;
          existing.weightedP99Sum += (p99ResponseTime || 0) * totalRequests;
        }
      }

      return grouped;
    };

    const grouped = buildGroupedMap(filteredRequestMetrics);
    const previousGrouped = buildGroupedMap(filteredPreviousRequestMetrics);
    const compareOffsetMs = TIME_WINDOW_CONFIG[timeWindow].windowMs;

    return expectedBuckets.map((bucket) => {
      const data = grouped.get(bucket);
      const compareData = compareMode ? previousGrouped.get(bucket - compareOffsetMs) : undefined;

      const totalRequests = data?.totalRequests ?? 0;
      const totalErrors = data?.totalErrors ?? 0;

      const compareTotalRequests = compareData?.totalRequests ?? 0;
      const compareTotalErrors = compareData?.totalErrors ?? 0;

      const avgLatency = totalRequests > 0 && data ? data.weightedLatencySum / totalRequests : null;
      const p95Latency = totalRequests > 0 && data ? data.weightedP95Sum / totalRequests : null;
      const p99Latency = totalRequests > 0 && data ? data.weightedP99Sum / totalRequests : null;
      const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
      const uptime = 100 - errorRate;

      const compareAvgLatency =
        compareMode && compareTotalRequests > 0 && compareData ? compareData.weightedLatencySum / compareTotalRequests : null;
      const compareP95Latency =
        compareMode && compareTotalRequests > 0 && compareData ? compareData.weightedP95Sum / compareTotalRequests : null;
      const compareP99Latency =
        compareMode && compareTotalRequests > 0 && compareData ? compareData.weightedP99Sum / compareTotalRequests : null;
      const compareErrorRate = compareMode && compareTotalRequests > 0 ? (compareTotalErrors / compareTotalRequests) * 100 : null;
      const compareUptime = compareMode && compareErrorRate !== null ? 100 - compareErrorRate : null;

      return {
        bucket,
        totalRequests,
        avgLatency,
        p95Latency,
        p99Latency,
        errorRate,
        uptime,
        compareTotalRequests: compareMode ? compareTotalRequests : null,
        compareAvgLatency,
        compareP95Latency,
        compareP99Latency,
        compareErrorRate,
        compareUptime,
      };
    });
  }, [filteredRequestMetrics, filteredPreviousRequestMetrics, expectedBuckets, compareMode, timeWindow]);

  const requestCountSeries = useMemo<TimeSeriesPoint[]>(() => {
    return requestTimeline.map((point) => ({
      ts: point.bucket,
      value: point.totalRequests,
      compareValue: point.compareTotalRequests,
    }));
  }, [requestTimeline]);

  const requestLatencySeries = useMemo<TimeSeriesPoint[]>(() => {
    return requestTimeline.map((point) => ({
      ts: point.bucket,
      value: point.avgLatency,
      secondaryValue: point.p95Latency,
      tertiaryValue: point.p99Latency,
      compareValue: point.compareAvgLatency,
      compareSecondaryValue: point.compareP95Latency,
      compareTertiaryValue: point.compareP99Latency,
    }));
  }, [requestTimeline]);

  const requestErrorRateSeries = useMemo<TimeSeriesPoint[]>(() => {
    return requestTimeline.map((point) => ({
      ts: point.bucket,
      value: point.errorRate,
      compareValue: point.compareErrorRate,
    }));
  }, [requestTimeline]);

  const requestUptimeSeries = useMemo<TimeSeriesPoint[]>(() => {
    return requestTimeline.map((point) => ({
      ts: point.bucket,
      value: point.uptime,
      compareValue: point.compareUptime,
    }));
  }, [requestTimeline]);

  const latestSystem = systemMetrics[systemMetrics.length - 1];

  return (
    <div className="min-h-screen bg-paper text-ink flex">
      <aside className="w-64 shrink-0 bg-white border-r-4 border-ink flex flex-col">
        <div className="p-6 border-b-2 border-ink">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-ink text-paper border-2 border-ink">
              <span className="text-base font-bold">BM</span>
            </div>
            <span className="text-xl font-black uppercase tracking-tight">BackendMonitor</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('system')}
            className={`w-full text-left px-4 py-3 border-2 border-ink font-bold text-base uppercase tracking-wide transition-colors ${
              activeTab === 'system' ? 'bg-primary text-white shadow-hard' : 'bg-white text-ink hover:bg-paper'
            }`}
          >
            System Metrics
          </button>
          <button
            onClick={() => setActiveTab('request')}
            className={`w-full text-left px-4 py-3 border-2 border-ink font-bold text-base uppercase tracking-wide transition-colors ${
              activeTab === 'request' ? 'bg-primary text-white shadow-hard' : 'bg-white text-ink hover:bg-paper'
            }`}
          >
            Request Metrics
          </button>
          <button
            onClick={() => setActiveTab('alert')}
            className={`w-full text-left px-4 py-3 border-2 border-ink font-bold text-base uppercase tracking-wide transition-colors ${
              activeTab === 'alert' ? 'bg-primary text-white shadow-hard' : 'bg-white text-ink hover:bg-paper'
            }`}
          >
            Alert Engine
          </button>
        </nav>

        <div className="p-4 border-t-2 border-ink space-y-2">
          <button
            onClick={() => navigate(`/dashboard/${projectId}`)}
            className="w-full px-4 py-3 border-2 border-ink bg-white hover:bg-paper text-ink font-bold text-sm uppercase tracking-wide"
          >
            Back to Project
          </button>
          <div className="flex items-center justify-between p-3 bg-paper border-2 border-ink">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary text-white flex items-center justify-center border-2 border-ink font-bold text-sm">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-sm font-bold truncate max-w-[180px]">{user?.email || 'User'}</span>
            </div>
            <button onClick={handleLogout} className="text-sm text-ink/60 hover:text-ink font-bold" title="Logout">
              ↗
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b-4 border-ink px-8 py-6">
          <h1 className="text-3xl font-black uppercase tracking-tight mb-1">{decodedServiceName}</h1>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <p className="text-base text-ink/60 font-mono">Service Metrics ({TIME_WINDOW_CONFIG[timeWindow].subtitle})</p>
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(TIME_WINDOW_CONFIG) as TimeWindow[]).map((windowKey) => (
                <button
                  key={windowKey}
                  onClick={() => setTimeWindow(windowKey)}
                  className={`px-3 py-2 border-2 border-ink text-sm font-bold uppercase tracking-wide ${
                    timeWindow === windowKey ? 'bg-primary text-white shadow-hard' : 'bg-white text-ink hover:bg-paper'
                  }`}
                >
                  {TIME_WINDOW_CONFIG[windowKey].label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-block w-12 h-12 border-4 border-ink border-t-primary animate-spin"></div>
                <p className="mt-4 text-base font-bold uppercase tracking-wide text-ink/60">Loading Metrics...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-white border-2 border-ink p-6 max-w-xl">
              <p className="text-base font-bold text-red-600">{error}</p>
              <button
                onClick={() => navigate(`/dashboard/${projectId}`)}
                className="mt-4 px-4 py-2 border-2 border-ink bg-paper hover:bg-white font-bold text-sm uppercase tracking-wide"
              >
                Back to Project
              </button>
            </div>
          ) : activeTab === 'system' ? (
            <section className="space-y-6">
              <h2 className="text-xl font-black uppercase tracking-tight">System Metrics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border-2 border-ink p-5 shadow-hard">
                  <p className="text-sm font-bold uppercase tracking-wide text-ink/60 mb-2">Avg CPU</p>
                  <p className="text-3xl font-black font-mono">{latestSystem ? `${latestSystem.avgCpu.toFixed(1)}%` : 'N/A'}</p>
                </div>
                <div className="bg-white border-2 border-ink p-5 shadow-hard">
                  <p className="text-sm font-bold uppercase tracking-wide text-ink/60 mb-2">Avg Memory</p>
                  <p className="text-3xl font-black font-mono">{latestSystem ? `${latestSystem.avgMemoryMb.toFixed(1)} MB` : 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <VolumeTimeChart
                  title="CPU Trend"
                  yLabel="CPU (%)"
                  unit="percent"
                  points={systemCpuSeries}
                  tone="primary"
                  chartType="line"
                  from={timeRange.from}
                  to={timeRange.to}
                  timeWindow={timeWindow}
                  showPeakMarker
                  peakLabelPrefix="Peak CPU"
                />
                <VolumeTimeChart
                  title="Memory Trend"
                  yLabel="Memory (MB)"
                  unit="mb"
                  points={systemMemorySeries}
                  tone="ink"
                  chartType="line"
                  from={timeRange.from}
                  to={timeRange.to}
                  timeWindow={timeWindow}
                  showPeakMarker
                  peakLabelPrefix="Peak Memory"
                />
              </div>

              <div className="bg-white border-2 border-ink shadow-hard">
                <div className="border-b-2 border-ink p-5 bg-paper">
                  <h2 className="text-lg font-black uppercase tracking-tight">System Metrics Buckets</h2>
                </div>
                {systemMetrics.length === 0 ? (
                  <div className="p-8 text-base text-ink/60">No system metrics collected yet.</div>
                ) : (
                  <div className="divide-y-2 divide-ink overflow-x-auto">
                    <div className="grid grid-cols-5 gap-4 px-5 py-3 bg-paper text-[11px] font-bold uppercase tracking-wide text-ink/70">
                      <div>Bucket</div>
                      <div>Avg CPU</div>
                      <div>Max CPU</div>
                      <div>Avg Memory</div>
                      <div>Max Memory</div>
                    </div>
                    {systemMetrics.map((point, idx) => (
                      <div key={`${String(point.bucket)}-${idx}`} className="grid grid-cols-5 gap-4 px-5 py-4 items-center text-sm font-mono text-ink/70">
                        <div>{new Date(Number(point.bucket)).toLocaleString()}</div>
                        <div>{point.avgCpu.toFixed(2)}%</div>
                        <div>{point.maxCpu.toFixed(2)}%</div>
                        <div>{point.avgMemoryMb.toFixed(2)} MB</div>
                        <div>{point.maxMemoryMb.toFixed(2)} MB</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : activeTab === 'request' ? (
            <section className="space-y-6">
              <h2 className="text-xl font-black uppercase tracking-tight">Request Metrics</h2>
              <div className="bg-white border-2 border-ink p-5 shadow-hard">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wide text-ink/70 mb-2">Method Filter</label>
                    <select
                      value={methodFilter}
                      onChange={(event) => {
                        setMethodFilter(event.target.value);
                        setEndpointFilter('all');
                      }}
                      className="w-full border-2 border-ink bg-white px-3 py-2 text-base font-mono"
                    >
                      <option value="all">All Methods</option>
                      {methodOptions.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wide text-ink/70 mb-2">Endpoint Filter</label>
                    <select
                      value={endpointFilter}
                      onChange={(event) => setEndpointFilter(event.target.value)}
                      className="w-full border-2 border-ink bg-white px-3 py-2 text-base font-mono"
                    >
                      <option value="all">All Endpoints</option>
                      {endpointOptions.map((endpoint) => (
                        <option key={endpoint} value={endpoint}>
                          {endpoint}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-sm font-mono text-ink/70">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showP95Line}
                      onChange={(event) => setShowP95Line(event.target.checked)}
                    />
                    Show p95 latency line
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={compareMode} onChange={(event) => setCompareMode(event.target.checked)} />
                    Compare with previous window
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showErrorThreshold}
                      onChange={(event) => setShowErrorThreshold(event.target.checked)}
                    />
                    Show error threshold
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wide text-ink/70 mb-2">Latency threshold (ms)</label>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={latencyThresholdMs}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setLatencyThresholdMs(Number.isFinite(next) && next >= 0 ? next : 0);
                      }}
                      className="w-full border-2 border-ink bg-white px-3 py-2 text-base font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wide text-ink/70 mb-2">Error threshold (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={errorThresholdPercent}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (!Number.isFinite(next)) {
                          setErrorThresholdPercent(0);
                          return;
                        }
                        setErrorThresholdPercent(Math.max(0, Math.min(100, next)));
                      }}
                      className="w-full border-2 border-ink bg-white px-3 py-2 text-base font-mono"
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="w-full border-2 border-ink bg-paper px-3 py-2 text-sm font-mono text-ink/70">
                      Selected threshold capacity: {formatValue(latencyThresholdMs, 'ms', true)} · {formatValue(errorThresholdPercent, 'percent', true)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <VolumeTimeChart
                  title="Request Count"
                  yLabel="Requests / minute"
                  unit="requests"
                  points={requestCountSeries}
                  tone="primary"
                  chartType="line"
                  from={timeRange.from}
                  to={timeRange.to}
                  timeWindow={timeWindow}
                  tooltipTotalLabel="Total Requests"
                  showPeakMarker
                  peakLabelPrefix="Peak"
                  yStartAtZero
                />
                <VolumeTimeChart
                  title="Latency"
                  yLabel="Latency (ms)"
                  unit="ms"
                  points={requestLatencySeries}
                  tone="ink"
                  chartType="line"
                  from={timeRange.from}
                  to={timeRange.to}
                  timeWindow={timeWindow}
                  showSecondaryLine={showP95Line}
                  secondaryLabel="p95"
                  showTertiaryLine
                  tertiaryLabel="p99"
                  thresholdLine={{ value: latencyThresholdMs, label: 'Latency threshold' }}
                  shadeAboveThreshold
                  thresholdAffectsSeriesColor
                  thresholdCapacityLabel={`Capacity ${formatValue(latencyThresholdMs, 'ms', true)}`}
                  yStartAtZero
                />
                <VolumeTimeChart
                  title="Error Rate"
                  yLabel="Error rate (%)"
                  unit="percent"
                  points={requestErrorRateSeries}
                  tone="ink"
                  chartType="line"
                  from={timeRange.from}
                  to={timeRange.to}
                  timeWindow={timeWindow}
                  yMode="percent"
                  thresholdLine={showErrorThreshold ? { value: errorThresholdPercent, label: `${formatValue(errorThresholdPercent, 'percent', true)} threshold` } : undefined}
                  thresholdAffectsSeriesColor
                  yStartAtZero
                />
                <VolumeTimeChart
                  title="Uptime"
                  yLabel="Uptime (%)"
                  unit="percent"
                  points={requestUptimeSeries}
                  tone="primary"
                  chartType="line"
                  from={timeRange.from}
                  to={timeRange.to}
                  timeWindow={timeWindow}
                  yMode="uptime"
                />
              </div>

              <div className="bg-white border-2 border-ink shadow-hard">
                <div className="border-b-2 border-ink p-5 bg-paper">
                  <h2 className="text-lg font-black uppercase tracking-tight">Endpoint-wise Request Metrics</h2>
                </div>

                {endpointAggregates.length === 0 ? (
                  <div className="p-8 text-base text-ink/60">No request metrics collected for selected filters.</div>
                ) : (
                  <div className="divide-y-2 divide-ink overflow-x-auto">
                    <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-paper text-[11px] font-bold uppercase tracking-wide text-ink/70">
                      <div className="col-span-1">Method</div>
                      <div className="col-span-3">Endpoint</div>
                      <div className="col-span-2">Requests</div>
                      <div className="col-span-2">Success</div>
                      <div className="col-span-2">Errors</div>
                      <div className="col-span-2">Avg Latency</div>
                    </div>

                    {endpointAggregates.map((row) => (
                      <div key={row.key} className="grid grid-cols-12 gap-4 px-5 py-4 items-center text-sm font-mono text-ink/70">
                        <div className="col-span-1 font-bold">{row.method}</div>
                        <div className="col-span-3">{row.route}</div>
                        <div className="col-span-2">{row.totalRequests}</div>
                        <div className="col-span-2">{row.successCount}</div>
                        <div className="col-span-2">{row.clientErrorCount + row.serverErrorCount}</div>
                        <div className="col-span-2">{row.avgResponseTime.toFixed(2)} ms</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="space-y-6">
              <h2 className="text-xl font-black uppercase tracking-tight">Alert Engine</h2>

              <div className="bg-white border-2 border-ink p-5 shadow-hard">
                <label className="block text-sm font-bold uppercase tracking-wide text-ink/70 mb-2">Project Slack Webhook URL</label>
                {projectSlackWebhookUrl ? (
                  <div className="w-full border-2 border-ink bg-paper px-3 py-2 text-sm font-mono text-ink/80 break-all">
                    {projectSlackWebhookUrl}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={pendingWebhookUrl}
                      onChange={(event) => setPendingWebhookUrl(event.target.value)}
                      placeholder="https://hooks.slack.com/services/..."
                      className="w-full border-2 border-ink bg-white px-3 py-2 text-base font-mono"
                    />
                    <button
                      onClick={saveProjectWebhook}
                      disabled={isAlertSubmitting || !pendingWebhookUrl.trim()}
                      className="px-4 py-2 border-2 border-ink bg-primary text-white font-bold text-sm uppercase tracking-wide disabled:opacity-60"
                    >
                      {isAlertSubmitting ? 'Saving...' : 'Save Webhook'}
                    </button>
                  </div>
                )}
                <p className="mt-2 text-xs font-bold text-ink/60 uppercase tracking-wide">
                  Webhook is configured once per project and used for all alert rules.
                </p>
              </div>

              {alertSuccess && (
                <div className="bg-white border-2 border-ink p-4 text-green-700 font-bold">{alertSuccess}</div>
              )}
              {alertError && (
                <div className="bg-white border-2 border-ink p-4 text-red-600 font-bold">{alertError}</div>
              )}

              <div className="bg-white border-2 border-ink shadow-hard">
                <div className="border-b-2 border-ink p-5 bg-paper">
                  <h3 className="text-lg font-black uppercase tracking-tight">System Metric Rule</h3>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wide text-ink/70 mb-2">Metric</label>
                    <select
                      value={systemMetricField}
                      onChange={(event) => setSystemMetricField(event.target.value as SystemAlertMetricField)}
                      className="w-full border-2 border-ink bg-white px-3 py-2 text-base font-mono"
                    >
                      {SYSTEM_ALERT_METRICS.map((metric) => (
                        <option key={metric.value} value={metric.value}>{metric.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wide text-ink/70 mb-2">Operator</label>
                    <select
                      value={systemOperator}
                      onChange={(event) => setSystemOperator(event.target.value as AlertOperator)}
                      className="w-full border-2 border-ink bg-white px-3 py-2 text-base font-mono"
                    >
                      {ALERT_OPERATORS.map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wide text-ink/70 mb-2">
                      Threshold ({getThresholdConfig(systemMetricField).unit || 'value'})
                    </label>
                    <input
                      type="number"
                      value={systemThreshold}
                      min={getThresholdConfig(systemMetricField).min}
                      max={getThresholdConfig(systemMetricField).max}
                      step={getThresholdConfig(systemMetricField).step}
                      onChange={(event) => setSystemThreshold(Number(event.target.value))}
                      onBlur={() => setSystemThreshold((prev) => normalizeThreshold(prev, systemMetricField))}
                      className="w-full border-2 border-ink bg-white px-3 py-2 text-base font-mono"
                    />
                    <p className="mt-1 text-xs font-bold text-ink/60 uppercase tracking-wide">
                      Min {getThresholdConfig(systemMetricField).min}
                      {getThresholdConfig(systemMetricField).max !== undefined ? ` · Max ${getThresholdConfig(systemMetricField).max}` : ''}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wide text-ink/70 mb-2">Window</label>
                    <select
                      value={systemWindowSec}
                      onChange={(event) => setSystemWindowSec(Number(event.target.value))}
                      className="w-full border-2 border-ink bg-white px-3 py-2 text-base font-mono"
                    >
                      {ALERT_WINDOW_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <button
                    onClick={createSystemAlertRule}
                    disabled={isAlertSubmitting || !projectSlackWebhookUrl.trim()}
                    className="px-4 py-2 border-2 border-ink bg-primary text-white font-bold text-sm uppercase tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isAlertSubmitting ? 'Creating...' : 'Create System Rule'}
                  </button>
                </div>
              </div>

              <div className="bg-white border-2 border-ink shadow-hard">
                <div className="border-b-2 border-ink p-5 bg-paper">
                  <h3 className="text-lg font-black uppercase tracking-tight">Request Metric Rule</h3>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wide text-ink/70 mb-2">Metric</label>
                    <select
                      value={requestMetricField}
                      onChange={(event) => setRequestMetricField(event.target.value as RequestAlertMetricField)}
                      className="w-full border-2 border-ink bg-white px-3 py-2 text-base font-mono"
                    >
                      {REQUEST_ALERT_METRICS.map((metric) => (
                        <option key={metric.value} value={metric.value}>{metric.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wide text-ink/70 mb-2">Operator</label>
                    <select
                      value={requestOperator}
                      onChange={(event) => setRequestOperator(event.target.value as AlertOperator)}
                      className="w-full border-2 border-ink bg-white px-3 py-2 text-base font-mono"
                    >
                      {ALERT_OPERATORS.map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wide text-ink/70 mb-2">
                      Threshold ({getThresholdConfig(requestMetricField).unit || 'value'})
                    </label>
                    <input
                      type="number"
                      value={requestThreshold}
                      min={getThresholdConfig(requestMetricField).min}
                      max={getThresholdConfig(requestMetricField).max}
                      step={getThresholdConfig(requestMetricField).step}
                      onChange={(event) => setRequestThreshold(Number(event.target.value))}
                      onBlur={() => setRequestThreshold((prev) => normalizeThreshold(prev, requestMetricField))}
                      className="w-full border-2 border-ink bg-white px-3 py-2 text-base font-mono"
                    />
                    <p className="mt-1 text-xs font-bold text-ink/60 uppercase tracking-wide">
                      Min {getThresholdConfig(requestMetricField).min}
                      {getThresholdConfig(requestMetricField).max !== undefined ? ` · Max ${getThresholdConfig(requestMetricField).max}` : ''}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wide text-ink/70 mb-2">Window</label>
                    <select
                      value={requestWindowSec}
                      onChange={(event) => setRequestWindowSec(Number(event.target.value))}
                      className="w-full border-2 border-ink bg-white px-3 py-2 text-base font-mono"
                    >
                      {ALERT_WINDOW_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wide text-ink/70 mb-2">Endpoint (optional)</label>
                    <select
                      value={requestEndpointRule}
                      onChange={(event) => setRequestEndpointRule(event.target.value)}
                      className="w-full border-2 border-ink bg-white px-3 py-2 text-base font-mono"
                    >
                      <option value="all">All Endpoints</option>
                      {endpointOptions.map((endpoint) => (
                        <option key={endpoint} value={endpoint}>
                          {endpoint}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <button
                    onClick={createRequestAlertRule}
                    disabled={isAlertSubmitting || !projectSlackWebhookUrl.trim()}
                    className="px-4 py-2 border-2 border-ink bg-primary text-white font-bold text-sm uppercase tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isAlertSubmitting ? 'Creating...' : 'Create Request Rule'}
                  </button>
                </div>
              </div>

              <div className="bg-white border-2 border-ink shadow-hard">
                <div className="border-b-2 border-ink p-5 bg-paper flex items-center justify-between">
                  <h3 className="text-lg font-black uppercase tracking-tight">Existing Alert Rules</h3>
                  <button
                    onClick={loadAlertRules}
                    className="px-3 py-2 border-2 border-ink bg-white hover:bg-paper font-bold text-xs uppercase tracking-wide"
                  >
                    Refresh
                  </button>
                </div>

                {isAlertRulesLoading ? (
                  <div className="p-5 text-sm font-bold text-ink/60">Loading alert rules...</div>
                ) : alertRules.length === 0 ? (
                  <div className="p-5 text-sm font-bold text-ink/60">No alert rules found for this service.</div>
                ) : (
                  <div className="divide-y-2 divide-ink">
                    {alertRules.map((rule) => (
                      <div key={rule.id} className="p-5 space-y-4 bg-white">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-sm font-mono text-ink/80">
                          <div className="border-2 border-ink bg-paper px-3 py-2">
                            <div className="text-[10px] uppercase font-bold text-ink/60">Type</div>
                            <div className="font-bold">{rule.metricType}</div>
                          </div>
                          <div className="border-2 border-ink bg-paper px-3 py-2">
                            <div className="text-[10px] uppercase font-bold text-ink/60">Metric</div>
                            <div className="font-bold">{rule.metricField}</div>
                          </div>
                          <div className="border-2 border-ink bg-paper px-3 py-2">
                            <div className="text-[10px] uppercase font-bold text-ink/60">Condition</div>
                            <div className="font-bold">{rule.operator} {rule.threshold}</div>
                          </div>
                          <div className="border-2 border-ink bg-paper px-3 py-2">
                            <div className="text-[10px] uppercase font-bold text-ink/60">Window</div>
                            <div className="font-bold">{ALERT_WINDOW_OPTIONS.find((w) => w.value === rule.windowSec)?.label || `${rule.windowSec}s`}</div>
                          </div>
                          <div className="border-2 border-ink bg-paper px-3 py-2">
                            <div className="text-[10px] uppercase font-bold text-ink/60">Endpoint</div>
                            <div className="font-bold">{rule.endpoint || 'All Endpoints'}</div>
                          </div>
                          <div className="border-2 border-ink bg-paper px-3 py-2">
                            <div className="text-[10px] uppercase font-bold text-ink/60">Status</div>
                            <div className="font-bold">{rule.isActive ? 'Active' : 'Inactive'}</div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => beginEditRule(rule)}
                            className="px-3 py-2 border-2 border-ink bg-white hover:bg-paper font-bold text-xs uppercase tracking-wide"
                          >
                            Edit
                          </button>
                        </div>

                        {editingRuleId === rule.id && (
                          <div className="p-4 border-2 border-ink bg-paper space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-ink/70 mb-2">
                                  Threshold ({getThresholdConfig(editingRuleMetricField).unit || 'value'})
                                </label>
                                <input
                                  type="number"
                                  value={editingThreshold}
                                  min={getThresholdConfig(editingRuleMetricField).min}
                                  max={getThresholdConfig(editingRuleMetricField).max}
                                  step={getThresholdConfig(editingRuleMetricField).step}
                                  onChange={(event) => setEditingThreshold(Number(event.target.value))}
                                  onBlur={() =>
                                    setEditingThreshold((prev) => normalizeThreshold(prev, editingRuleMetricField))
                                  }
                                  className="w-full border-2 border-ink bg-white px-3 py-2 text-sm font-mono"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-ink/70 mb-2">
                                  Window
                                </label>
                                <select
                                  value={editingWindowSec}
                                  onChange={(event) => setEditingWindowSec(Number(event.target.value))}
                                  className="w-full border-2 border-ink bg-white px-3 py-2 text-sm font-mono"
                                >
                                  {ALERT_WINDOW_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={saveEditedRule}
                                disabled={isAlertSubmitting || !projectSlackWebhookUrl.trim()}
                                className="px-3 py-2 border-2 border-ink bg-primary text-white font-bold text-xs uppercase tracking-wide disabled:opacity-60"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingRuleId(null)}
                                className="px-3 py-2 border-2 border-ink bg-white hover:bg-paper font-bold text-xs uppercase tracking-wide"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default ServiceMetricsPage;
