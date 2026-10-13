// world_rhythm.cpp — implementation of the deterministic world state port.
//
// Every rule below mirrors src/core/worldRhythm.ts exactly:
//   dayPhase   → PhaseOf      (same UTC minute boundaries)
//   hashOf     → HashOf       (same FNV-1a on the same ASCII key)
//   EVENT_DEFS → DefFor       (same startMinute/lengthMinutes per world)
//   worldEvent/nextWorldEvent → EventAt/NextEvent (same math)
//   worldMood  → WorldMood    (hashOf("<world>:<day>") % 100)

#include "world_rhythm.h"

#include <algorithm>
#include <string>

namespace guinomo {

const char* DayPhaseName(DayPhase p) {
  switch (p) {
    case DayPhase::kNight: return "night";
    case DayPhase::kDawn: return "dawn";
    case DayPhase::kDay: return "day";
    case DayPhase::kDusk: return "dusk";
  }
  return "night";
}

bool ParseDayPhase(const char* name, DayPhase* out) {
  const std::string s(name);
  if (s == "night") *out = DayPhase::kNight;
  else if (s == "dawn") *out = DayPhase::kDawn;
  else if (s == "day") *out = DayPhase::kDay;
  else if (s == "dusk") *out = DayPhase::kDusk;
  else return false;
  return true;
}

World ParseWorld(const std::string& name) {
  if (name == "lobby") return World::kLobby;
  if (name == "alien") return World::kAlien;
  if (name == "forest") return World::kForest;
  if (name == "floating-city") return World::kFloatingCity;
  if (name == "tropical-city") return World::kTropicalCity;
  if (name == "old-town") return World::kOldTown;
  return World::kUnknown;
}

const char* WorldName(World w) {
  switch (w) {
    case World::kLobby: return "lobby";
    case World::kAlien: return "alien";
    case World::kForest: return "forest";
    case World::kFloatingCity: return "floating-city";
    case World::kTropicalCity: return "tropical-city";
    case World::kOldTown: return "old-town";
    default: return "unknown";
  }
}

DayPhase PhaseOf(int64_t minutes) {
  const int64_t m = MinuteOfDay(minutes);
  if (m < 6 * 60) return DayPhase::kNight;
  if (m < 11 * 60) return DayPhase::kDawn;
  if (m < 17 * 60) return DayPhase::kDay;
  if (m < 21 * 60) return DayPhase::kDusk;
  return DayPhase::kNight;
}

uint32_t HashOf(const std::string& key) {
  uint32_t hash = 0x811c9dc5u;
  for (unsigned char c : key) {
    hash ^= c;
    hash *= 0x01000193u;  // u32 wrap == Math.imul + >>>0 no TS
  }
  return hash;
}

int WorldMood(World world, int64_t minutes) {
  if (world == World::kUnknown) return -1;
  const std::string key = std::string(WorldName(world)) + ":" + std::to_string(DayOfMinutes(minutes));
  return static_cast<int>(HashOf(key) % 100);
}

struct EventDef {
  World world;
  int64_t startMinute;    // minute-of-day UTC
  int64_t lengthMinutes;  // minutes the daily window stays open
};

const EventDef* DefFor(World world) {
  static const EventDef kDefs[] = {
      {World::kLobby, 22 * 60, 90},
      {World::kAlien, 20 * 60, 60},
      {World::kForest, 6 * 60 + 30, 60},
      {World::kFloatingCity, 18 * 60, 90},
      {World::kTropicalCity, 17 * 60, 90},
      {World::kOldTown, 19 * 60, 120},
  };
  for (const EventDef& d : kDefs) {
    if (d.world == world) return &d;
  }
  return nullptr;
}

WorldEvent EventAt(World world, int64_t minutes) {
  const EventDef* def = DefFor(world);
  if (!def) return {false, -1, -1};
  const int64_t day = DayOfMinutes(minutes);
  const int64_t start = day * kMinutesPerDay + def->startMinute;
  const int64_t end = std::min(start + def->lengthMinutes, (day + 1) * kMinutesPerDay);
  if (minutes < start || minutes >= end) return {false, -1, -1};
  return {true, start, end};
}

WorldEvent NextEvent(World world, int64_t minutes) {
  const EventDef* def = DefFor(world);
  if (!def) return {false, -1, -1};
  const int64_t day = DayOfMinutes(minutes);
  int64_t start = day * kMinutesPerDay + def->startMinute;
  int64_t end = std::min(start + def->lengthMinutes, (day + 1) * kMinutesPerDay);
  if (minutes >= end) {
    start = (day + 1) * kMinutesPerDay + def->startMinute;
    end = std::min(start + def->lengthMinutes, (day + 2) * kMinutesPerDay);
  }
  return {true, start, end};
}

}  // namespace guinomo