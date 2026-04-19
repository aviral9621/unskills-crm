import { Svg, Path, Rect, Line, Circle, G } from '@react-pdf/renderer'
import { CERT_COLORS } from './certificate-theme'

type Placement = {
  top?: number | string
  right?: number | string
  bottom?: number | string
  left?: number | string
}

/**
 * Baroque scrollwork corner ornament. Use `rotation` 0 / 90 / 180 / 270
 * for TL / TR / BR / BL respectively. Rotation happens around the centre
 * of the SVG viewbox via an SVG <G transform> so it renders reliably in
 * @react-pdf (CSS `transform` on Svg is not always honoured).
 */
export function CornerFlourish({
  size = 60,
  rotation = 0,
  ...placement
}: { size?: number; rotation?: number } & Placement) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      style={{ position: 'absolute', ...placement }}
    >
      <G transform={`rotate(${rotation} 30 30)`}>
        {/* Main scroll curve */}
        <Path
          d="M 2 2 L 2 20 Q 2 2 20 2 L 38 2"
          stroke={CERT_COLORS.gold}
          strokeWidth={1.5}
          fill="none"
        />
        {/* Secondary inner curve */}
        <Path
          d="M 6 6 L 6 18 Q 6 6 18 6 L 34 6"
          stroke={CERT_COLORS.gold}
          strokeWidth={0.8}
          fill="none"
        />
        {/* Spiral volute at the turn */}
        <Path
          d="M 8 12 Q 12 8 16 12 Q 20 16 16 20 Q 12 24 8 20 Q 4 16 8 12 Z"
          fill={CERT_COLORS.gold}
          opacity={0.4}
        />
        {/* Small decorative dot */}
        <Circle cx={12} cy={16} r={1.2} fill={CERT_COLORS.goldDark} />
        {/* Accent diamond */}
        <Path
          d="M 30 4 L 33 8 L 30 12 L 27 8 Z"
          fill={CERT_COLORS.frameAccent}
          opacity={0.7}
        />
        {/* Tapering tail curve */}
        <Path
          d="M 4 30 Q 4 38 10 42 Q 16 46 20 42"
          stroke={CERT_COLORS.gold}
          strokeWidth={1}
          fill="none"
        />
      </G>
    </Svg>
  )
}

/**
 * Decorative divider — thin gold line with centre navy diamond.
 * Use below certificate titles.
 */
export function TitleDivider({ width = 200 }: { width?: number }) {
  const cx = width / 2
  return (
    <Svg width={width} height={10} style={{ alignSelf: 'center', marginVertical: 4 }}>
      <Line x1={0} y1={5} x2={cx - 10} y2={5} stroke={CERT_COLORS.gold} strokeWidth={0.8} />
      <Path
        d={`M ${cx} 1 L ${cx + 4} 5 L ${cx} 9 L ${cx - 4} 5 Z`}
        fill={CERT_COLORS.titleNavy}
      />
      <Line x1={cx + 10} y1={5} x2={width} y2={5} stroke={CERT_COLORS.gold} strokeWidth={0.8} />
    </Svg>
  )
}

/** Small solid square accent — used inline flanking text. */
export function SquareAccent({
  size = 4,
  color = CERT_COLORS.titleNavy,
}: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size}>
      <Rect width={size} height={size} fill={color} />
    </Svg>
  )
}

/** Small cartouche/medallion — placed at mid-edge of frame. */
export function EdgeOrnament({
  width = 40,
  height = 14,
}: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 40 14">
      <Path d="M 4 7 L 20 1 L 36 7 L 20 13 Z" fill={CERT_COLORS.gold} opacity={0.5} />
      <Path d="M 12 7 L 20 4 L 28 7 L 20 10 Z" fill={CERT_COLORS.goldDark} />
      <Circle cx={20} cy={7} r={1} fill={CERT_COLORS.subtleTint} />
    </Svg>
  )
}

/** Gold medallion with red ribbon tails — portrait decorative anchor. */
export function RibbonSeal({ size = 50 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.3} viewBox="0 0 50 65">
      <Circle cx={25} cy={22} r={18} fill={CERT_COLORS.gold} opacity={0.9} />
      <Circle cx={25} cy={22} r={15} fill="none" stroke={CERT_COLORS.goldDark} strokeWidth={0.8} />
      <Circle cx={25} cy={22} r={11} fill="none" stroke={CERT_COLORS.goldDark} strokeWidth={0.5} />
      <Path
        d="M 25 14 L 27 20 L 33 20 L 28 24 L 30 30 L 25 26 L 20 30 L 22 24 L 17 20 L 23 20 Z"
        fill={CERT_COLORS.goldLight}
      />
      <Path d="M 15 38 L 10 58 L 18 52 L 22 42 Z" fill={CERT_COLORS.frameAccent} opacity={0.85} />
      <Path d="M 35 38 L 40 58 L 32 52 L 28 42 Z" fill={CERT_COLORS.frameAccent} opacity={0.85} />
    </Svg>
  )
}

/** Thin gold L-bracket for portrait corners. */
export function CornerBracket({
  size = 30,
  rotation = 0,
  ...placement
}: { size?: number; rotation?: number } & Placement) {
  return (
    <Svg width={size} height={size} viewBox="0 0 30 30" style={{ position: 'absolute', ...placement }}>
      <G transform={`rotate(${rotation} 15 15)`}>
        <Path d="M 0 0 L 0 24 M 0 0 L 24 0" stroke={CERT_COLORS.gold} strokeWidth={1.2} fill="none" />
      </G>
    </Svg>
  )
}
