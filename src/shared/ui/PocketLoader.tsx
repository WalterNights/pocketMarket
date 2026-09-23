import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

/**
 * The app's own loading mark: a receipt adding itself up.
 *
 * Three short lines appear one after another — the items — and a longer line
 * underneath fills from the left: the total. It is the one thing this app
 * does, drawn small, and it reads as "counting" rather than "waiting", which a
 * rotating circle never does.
 *
 * No colour and no shadow, per docs/design/00-visual-direction.md: the bars are
 * `--muted` and the total is `--foreground`. It works on cream and on dark
 * without a single conditional.
 */

type Percent = `${number}%`

/** Item bars, with the width each one settles at. */
const ITEMS: readonly { id: string; width: Percent }[] = [
  { id: 'a', width: '62%' },
  { id: 'b', width: '84%' },
  { id: 'c', width: '48%' },
]

const ITEM_MS = 260
const HOLD_MS = 420
const TOTAL_MS = 520

type PocketLoaderProps = {
  /** Height of one bar. The whole mark scales from this. */
  size?: number
  label?: string
}

export function PocketLoader({ size = 8, label = 'Cargando' }: PocketLoaderProps) {
  // A single clock drives every bar: one value from 0 to 1 per cycle, read at
  // different offsets. Three independent animations would drift apart.
  const progress = useSharedValue(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) {
      // Reduced motion still needs to say "working", so the mark breathes
      // instead of drawing itself (rule: respect useReducedMotion).
      progress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      )
      return
    }

    progress.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: ITEMS.length * ITEM_MS + TOTAL_MS,
          easing: Easing.out(Easing.quad),
        }),
        withDelay(HOLD_MS, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    )

    return () => {
      cancelAnimation(progress)
    }
  }, [progress, reduced])

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      // The mark is decorative; the label above is what a screen reader needs.
      style={{ width: size * 14 }}
    >
      {ITEMS.map((item, index) => (
        <ItemBar
          key={item.id}
          index={index}
          width={item.width}
          size={size}
          progress={progress}
          reduced={reduced}
        />
      ))}

      {/* The rule above the total, exactly like a receipt. */}
      <View className="mt-2 h-px w-full bg-border" />

      <TotalBar size={size} progress={progress} reduced={reduced} />
    </View>
  )
}

type BarProps = {
  size: number
  progress: SharedValue<number>
  reduced: boolean
}

function ItemBar({
  index,
  width,
  size,
  progress,
  reduced,
}: BarProps & { index: number; width: Percent }) {
  // Where in the cycle this bar belongs. Items share the first stretch, the
  // total owns the last.
  const span = 1 / (ITEMS.length + TOTAL_MS / ITEM_MS)
  const start = index * span

  const style = useAnimatedStyle(() => {
    if (reduced) return { opacity: progress.value }

    const local = (progress.value - start) / span
    const clamped = local < 0 ? 0 : local > 1 ? 1 : local
    return { opacity: clamped }
  })

  return (
    <Animated.View
      style={[style, { width, height: size, borderRadius: size / 2, marginTop: size }]}
      className="bg-muted"
    />
  )
}

function TotalBar({ size, progress, reduced }: BarProps) {
  const style = useAnimatedStyle(() => {
    if (reduced) return { transform: [{ scaleX: progress.value }] }

    const start = (ITEMS.length * ITEM_MS) / (ITEMS.length * ITEM_MS + TOTAL_MS)
    const local = (progress.value - start) / (1 - start)
    const clamped = local < 0 ? 0 : local > 1 ? 1 : local
    return { transform: [{ scaleX: clamped }] }
  })

  return (
    <View style={{ height: size, marginTop: size, width: '70%' }}>
      <Animated.View
        style={[
          style,
          // scaleX grows from the centre by default; the origin is moved left
          // so the total fills the way a number is written.
          { height: size, borderRadius: size / 2, width: '100%', transformOrigin: 'left' },
        ]}
        className="bg-foreground"
      />
    </View>
  )
}
