'use client';

import { useEffect, useRef } from 'react';
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
  type WhitespaceData,
} from 'lightweight-charts';
import type { EngineOutput, TradeLevels } from '@/lib/signals/engine';
import type { Zone } from '@/lib/indicators';
import type { Candle, Timeframe } from '@/lib/types';
import type { Settings } from '@/hooks/useSettings';

const COLORS = {
  bg: '#0b0e14',
  text: '#9aa3b5',
  grid: '#161c2b',
  bull: '#26a69a',
  bear: '#ef5350',
  gold: '#e6b450',
  nwBand: '#7e57c2',
  nwMid: '#b39ddb',
  ema20: '#42a5f5',
  ema50: '#ffa726',
  ema200: '#ec407a',
  entry: '#42a5f5',
};

interface Props {
  candles: Candle[];
  output: EngineOutput | null;
  timeframe: Timeframe;
  settings: Settings;
  /** Trade levels to draw (the latest signal). */
  levels: TradeLevels | null;
}

type LineSeries = ISeriesApi<'Line'>;

interface ChartRefs {
  main: IChartApi;
  rsiChart: IChartApi;
  candles: ISeriesApi<'Candlestick'>;
  nwUpper: LineSeries;
  nwMid: LineSeries;
  nwLower: LineSeries;
  ema20: LineSeries;
  ema50: LineSeries;
  ema200: LineSeries;
  rsi: LineSeries;
  priceLines: IPriceLine[];
}

const toTime = (t: number) => t as UTCTimestamp;

function lineData(candles: Candle[], values: number[] | undefined, visible: boolean): (LineData | WhitespaceData)[] {
  // Whitespace points keep logical indices aligned between the price and RSI panes.
  return candles.map((c, i) => {
    const v = values?.[i];
    return visible && v !== undefined && Number.isFinite(v) ? { time: toTime(c.time), value: v } : { time: toTime(c.time) };
  });
}

export default function PriceChart({ candles, output, timeframe, settings, levels }: Props) {
  const mainEl = useRef<HTMLDivElement>(null);
  const rsiEl = useRef<HTMLDivElement>(null);
  const overlayEl = useRef<HTMLCanvasElement>(null);
  const refs = useRef<ChartRefs | null>(null);
  const zonesRef = useRef<Zone[]>([]);
  const fittedFor = useRef<Timeframe | null>(null);

  // Create both panes once.
  useEffect(() => {
    if (!mainEl.current || !rsiEl.current) return;
    const common = {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: COLORS.bg },
        textColor: COLORS.text,
        fontSize: 11,
      },
      grid: { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#222a3d', minimumWidth: 72 },
      timeScale: { borderColor: '#222a3d', timeVisible: true, secondsVisible: false, rightOffset: 8 },
    };
    const main = createChart(mainEl.current, common);
    const rsiChart = createChart(rsiEl.current, { ...common, timeScale: { ...common.timeScale, visible: true } });

    const quiet = { lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false };
    const r: ChartRefs = {
      main,
      rsiChart,
      candles: main.addCandlestickSeries({
        upColor: COLORS.bull,
        downColor: COLORS.bear,
        borderVisible: false,
        wickUpColor: COLORS.bull,
        wickDownColor: COLORS.bear,
        priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      }),
      nwUpper: main.addLineSeries({ ...quiet, color: COLORS.nwBand, lineWidth: 2 }),
      nwMid: main.addLineSeries({ ...quiet, color: COLORS.nwMid, lineWidth: 1, lineStyle: LineStyle.Dotted }),
      nwLower: main.addLineSeries({ ...quiet, color: COLORS.nwBand, lineWidth: 2 }),
      ema20: main.addLineSeries({ ...quiet, color: COLORS.ema20, lineWidth: 1 }),
      ema50: main.addLineSeries({ ...quiet, color: COLORS.ema50, lineWidth: 1 }),
      ema200: main.addLineSeries({ ...quiet, color: COLORS.ema200, lineWidth: 2 }),
      rsi: rsiChart.addLineSeries({ color: '#ab47bc', lineWidth: 2, priceLineVisible: false }),
      priceLines: [],
    };
    for (const [price, color] of [
      [70, COLORS.bear],
      [50, '#3a4258'],
      [30, COLORS.bull],
    ] as const) {
      r.rsi.createPriceLine({ price, color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '' });
    }
    refs.current = r;

    // Keep the RSI pane scrolled/zoomed with the price pane (and vice versa).
    let syncing = false;
    const sync = (target: IChartApi) => (range: { from: number; to: number } | null) => {
      if (syncing || !range) return;
      syncing = true;
      target.timeScale().setVisibleLogicalRange(range);
      syncing = false;
    };
    const toRsi = sync(rsiChart);
    const toMain = sync(main);
    main.timeScale().subscribeVisibleLogicalRangeChange(toRsi);
    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(toMain);

    // Order blocks / FVGs are drawn on a canvas overlay, since the library has no rectangles.
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const canvas = overlayEl.current;
      const host = mainEl.current;
      if (!canvas || !host) return;
      const dpr = window.devicePixelRatio || 1;
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      const g = canvas.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const plotRight = w - main.priceScale('right').width();
      const plotBottom = h - main.timeScale().height();
      g.save();
      g.beginPath();
      g.rect(0, 0, plotRight, plotBottom);
      g.clip();
      for (const z of zonesRef.current) {
        const x = main.timeScale().timeToCoordinate(toTime(z.startTime));
        const yTop = r.candles.priceToCoordinate(z.top);
        const yBottom = r.candles.priceToCoordinate(z.bottom);
        if (yTop === null || yBottom === null) continue;
        const x0 = x ?? 0;
        const bull = z.direction === 'bullish';
        const isOb = z.kind === 'OB';
        g.fillStyle = bull
          ? isOb ? 'rgba(38,166,154,0.18)' : 'rgba(38,166,154,0.08)'
          : isOb ? 'rgba(239,83,80,0.18)' : 'rgba(239,83,80,0.08)';
        g.strokeStyle = bull ? 'rgba(38,166,154,0.55)' : 'rgba(239,83,80,0.55)';
        g.lineWidth = 1;
        g.setLineDash(isOb ? [] : [4, 3]);
        const y = Math.min(yTop, yBottom);
        const height = Math.max(Math.abs(yBottom - yTop), 1);
        g.fillRect(x0, y, plotRight - x0, height);
        g.strokeRect(x0 + 0.5, y + 0.5, plotRight - x0, height);
        g.fillStyle = bull ? '#4db6ac' : '#e57373';
        g.font = '10px ui-monospace, monospace';
        g.fillText(`${bull ? 'Bull' : 'Bear'} ${z.kind}`, x0 + 4, y + 11);
      }
      g.restore();
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      main.timeScale().unsubscribeVisibleLogicalRangeChange(toRsi);
      rsiChart.timeScale().unsubscribeVisibleLogicalRangeChange(toMain);
      main.remove();
      rsiChart.remove();
      refs.current = null;
    };
  }, []);

  // Push data, overlays, markers and levels whenever inputs change.
  useEffect(() => {
    const r = refs.current;
    if (!r) return;

    r.candles.setData(
      candles.map((c) => ({ time: toTime(c.time), open: c.open, high: c.high, low: c.low, close: c.close })),
    );
    const s = output?.series;
    r.nwUpper.setData(lineData(candles, s?.nadaraya.upper, settings.showNadaraya));
    r.nwMid.setData(lineData(candles, s?.nadaraya.mid, settings.showNadaraya));
    r.nwLower.setData(lineData(candles, s?.nadaraya.lower, settings.showNadaraya));
    r.ema20.setData(lineData(candles, s?.ema20, settings.showEma));
    r.ema50.setData(lineData(candles, s?.ema50, settings.showEma));
    r.ema200.setData(lineData(candles, s?.ema200, settings.showEma));
    r.rsi.setData(lineData(candles, s?.rsi, true));

    // Markers: signals and SMC structure breaks.
    const markers: SeriesMarker<Time>[] = [];
    for (const sig of output?.signals ?? []) {
      const buy = sig.signal.includes('BUY');
      markers.push({
        time: toTime(sig.time),
        position: buy ? 'belowBar' : 'aboveBar',
        color: buy ? COLORS.bull : COLORS.bear,
        shape: buy ? 'arrowUp' : 'arrowDown',
        text: sig.signal,
        size: sig.signal.startsWith('STRONG') ? 2 : 1,
      });
    }
    if (settings.showStructure) {
      for (const st of output?.smc.structures.slice(-30) ?? []) {
        const bull = st.direction === 'bullish';
        markers.push({
          time: toTime(st.time),
          position: bull ? 'aboveBar' : 'belowBar',
          color: bull ? '#80cbc4' : '#ef9a9a',
          shape: 'circle',
          text: st.type,
          size: 0.5,
        });
      }
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    r.candles.setMarkers(markers);

    // Price lines: Fibonacci levels and the active trade plan.
    r.priceLines.forEach((l) => r.candles.removePriceLine(l));
    r.priceLines = [];
    if (settings.showFib && output?.fib) {
      for (const lvl of output.fib.levels) {
        r.priceLines.push(
          r.candles.createPriceLine({
            price: lvl.price,
            color: lvl.golden ? COLORS.gold : lvl.extension ? 'rgba(230,180,80,0.35)' : 'rgba(154,163,181,0.35)',
            lineWidth: lvl.golden ? 2 : 1,
            lineStyle: lvl.golden ? LineStyle.Solid : LineStyle.Dashed,
            axisLabelVisible: lvl.golden,
            title: `Fib ${lvl.ratio}`,
          }),
        );
      }
    }
    if (levels) {
      const plan: Array<[number, string, string]> = [
        [levels.entry, COLORS.entry, 'Entry'],
        [levels.stopLoss, COLORS.bear, 'SL'],
        [levels.tp1, COLORS.bull, 'TP1'],
        [levels.tp2, COLORS.bull, 'TP2'],
        [levels.tp3, COLORS.bull, 'TP3'],
      ];
      for (const [price, color, title] of plan) {
        r.priceLines.push(
          r.candles.createPriceLine({ price, color, lineWidth: 1, lineStyle: LineStyle.LargeDashed, axisLabelVisible: true, title }),
        );
      }
    }

    zonesRef.current = settings.showZones ? (output?.activeZones ?? []) : [];

    if (candles.length && fittedFor.current !== timeframe) {
      fittedFor.current = timeframe;
      const to = candles.length + 8;
      r.main.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 150), to });
    }
  }, [candles, output, settings, levels, timeframe]);

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <div ref={mainEl} className="absolute inset-0" />
        <canvas ref={overlayEl} className="pointer-events-none absolute left-0 top-0 z-[5]" />
      </div>
      <div className="relative h-[130px] border-t border-line">
        <span className="absolute left-2 top-1 z-10 text-[10px] uppercase tracking-wider text-muted">RSI 14</span>
        <div ref={rsiEl} className="absolute inset-0" />
      </div>
    </div>
  );
}
