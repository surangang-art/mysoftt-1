export interface ScoreWeights {
  /** Nadaraya-Watson envelope touch / reversal. */
  nadaraya: number;
  /** Price retesting an active SMC order block (or FVG at a reduced weight). */
  smcZone: number;
  /** SMC market structure (trend, recent CHoCH). */
  smcStructure: number;
  /** Regular RSI divergence. */
  rsiDivergence: number;
  /** RSI overbought / oversold. */
  rsiLevel: number;
  /** Price inside the Fibonacci golden zone (0.5 - 0.786) of the current leg. */
  fibonacci: number;
  /** EMA 20/50/200 alignment. */
  ema: number;
  /** MACD histogram momentum. */
  macd: number;
}

export interface EngineConfig {
  weights: ScoreWeights;
  /** Minimum score (0-100) for a STRONG signal. */
  strongThreshold: number;
  /** Minimum score (0-100) for a regular signal. */
  signalThreshold: number;
  /** Minimum gap between the winning side's score and the other side's. */
  minEdge: number;
  /**
   * STRONG signals require all three core conditions to agree: Nadaraya band
   * touch, RSI divergence/extreme, and an SMC order block retest.
   */
  requireCoreConfluence: boolean;
  /** Bars after a band touch / divergence / CHoCH that it still counts. */
  recencyBars: number;
  rsiPeriod: number;
  rsiOverbought: number;
  rsiOversold: number;
  atrPeriod: number;
  /** Stop-loss distance is clamped to [slMinAtr, slMaxAtr] x ATR. */
  slMinAtr: number;
  slMaxAtr: number;
  /** Buffer beyond the structural invalidation level, in ATR. */
  slBufferAtr: number;
  fibLookback: number;
  swingLength: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  nadaraya: 20,
  smcZone: 15,
  smcStructure: 10,
  rsiDivergence: 12,
  rsiLevel: 8,
  fibonacci: 15,
  ema: 12,
  macd: 8,
};

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  weights: DEFAULT_WEIGHTS,
  strongThreshold: 70,
  signalThreshold: 50,
  minEdge: 20,
  requireCoreConfluence: true,
  recencyBars: 5,
  rsiPeriod: 14,
  rsiOverbought: 70,
  rsiOversold: 30,
  atrPeriod: 14,
  slMinAtr: 1,
  slMaxAtr: 3,
  slBufferAtr: 0.25,
  fibLookback: 150,
  swingLength: 5,
};
