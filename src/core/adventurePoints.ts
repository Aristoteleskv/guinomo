// Adventure points (soft XP): a light progression for exploration actions.
// The base points of each activity are doubled while the daily golden hour is
// active. Persisted in localStorage; the pure `pointsForActivity` helper keeps
// the multiplier rule easy to test.

const POINTS_STORAGE_KEY = 'guinomo.points.v1';

/** Points multiplier applied during the golden hour. */
export const GOLDEN_POINTS_MULTIPLIER = 2;

/** Base points per activity (before the golden-hour multiplier). */
export const POINTS = {
  secret: 50,
  poster: 5,
  streakVisit: 10,
  friendMeet: 25,
  pair: 40,
  /** One-time 5/5 finale bonus (the Grand Secret). */
  grandSecret: 200,
} as const;

interface PointsState {
  total: number;
  /** Local day key of the last claimed daily streak reward. */
  dailyStreakClaim: string;
}

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function readState(): PointsState {
  try {
    const parsed = JSON.parse(localStorage.getItem(POINTS_STORAGE_KEY) || '{}');
    if (parsed && typeof parsed === 'object' && typeof (parsed as PointsState).total === 'number') {
      return {
        total: (parsed as PointsState).total,
        dailyStreakClaim: typeof (parsed as PointsState).dailyStreakClaim === 'string'
          ? (parsed as PointsState).dailyStreakClaim
          : '',
      };
    }
  } catch {
    // Private mode / no storage: points live for the session only.
  }
  return { total: 0, dailyStreakClaim: '' };
}

function writeState(state: PointsState): void {
  try {
    localStorage.setItem(POINTS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode: keep the session-only total.
  }
}

/** Pure rule: the points gained for an activity, doubled during the golden hour. */
export function pointsForActivity(base: number, duringGoldenHour: boolean): number {
  return base * (duringGoldenHour ? GOLDEN_POINTS_MULTIPLIER : 1);
}

/** Current adventure points total. */
export function readPoints(): number {
  return readState().total;
}

/** Awards `base` points (×2 during the golden hour) and returns the gain. */
export function awardPoints(base: number, duringGoldenHour: boolean): number {
  const gain = pointsForActivity(base, duringGoldenHour);
  const state = readState();
  writeState({ ...state, total: state.total + gain });
  return gain;
}

/** Daily visit reward: POINTS.streakVisit, claimed once per local day (no
 *  golden multiplier — it is a fixed habit reward). Returns the gain (0 when
 *  already claimed today). */
export function claimDailyStreakPoints(): number {
  const today = dayKey(new Date());
  const state = readState();
  if (state.dailyStreakClaim === today) return 0;
  writeState({ ...state, total: state.total + POINTS.streakVisit, dailyStreakClaim: today });
  return POINTS.streakVisit;
}