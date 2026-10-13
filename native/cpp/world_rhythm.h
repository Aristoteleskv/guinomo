// world_rhythm.h — deterministic world state, C++ port of src/core/worldRhythm.ts
//
// Same pure functions, same arithmetic (FNV-1a over uint32 = Math.imul + >>>0),
// so the same (world, minutes) pair always yields the same state. This is the
// "deterministic core" that later compiles to WASM and is shared by client and
// server (Fase A/B de docs/CPP_STRATEGY.md).

#pragma once

#include <cstdint>
#include <string>

namespace guinomo {

constexpr int64_t kMinutesPerDay = 24 * 60;

enum class DayPhase { kNight, kDawn, kDay, kDusk };

enum class World {
  kLobby,
  kAlien,
  kForest,
  kFloatingCity,
  kTropicalCity,
  kOldTown,
  kUnknown,
};

// --- pure functions (1:1 com o TS) ---

/** Minute within the UTC day, 0..1439 (normaliza negativos, como o TS). */
constexpr int64_t MinuteOfDay(int64_t minutes) {
  return ((minutes % kMinutesPerDay) + kMinutesPerDay) % kMinutesPerDay;
}

/** UTC day index (truncation == floor para minutos >= 0, como o TS). */
constexpr int64_t DayOfMinutes(int64_t minutes) { return minutes / kMinutesPerDay; }

/** Rough phase of the UTC day. */
DayPhase PhaseOf(int64_t minutes);

/** FNV-1a — identical to the TS hashOf (uint32 wraps like Math.imul + >>>0). */
uint32_t HashOf(const std::string& key);

/** Mood 0..99, stable per (world, UTC day). Unknown world → -1. */
int WorldMood(World world, int64_t minutes);

struct WorldEvent {
  bool active;      // false when no event is running (or unknown world)
  int64_t start;    // UTC minutes, -1 when !active
  int64_t end;      // UTC minutes (exclusive), -1 when !active
};

/** The world's daily event when active at `minutes`. */
WorldEvent EventAt(World world, int64_t minutes);

/** Next (or running) window of the daily event from `minutes`. */
WorldEvent NextEvent(World world, int64_t minutes);

// --- parsing helpers (para o parity_test) ---

const char* DayPhaseName(DayPhase p);
bool ParseDayPhase(const char* name, DayPhase* out);
World ParseWorld(const std::string& name);
const char* WorldName(World w);

}  // namespace guinomo