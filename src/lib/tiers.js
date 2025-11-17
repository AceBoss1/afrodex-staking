// Tier thresholds
export const TIER_RULES = {
  Cadet: {
    minStake: 1_000_000_000n,
    L1: 0,
    L2_5: 0,
    depth: 1,
  },
  Captain: {
    minStake: 5_000_000_000n,
    L1: 5,
    L2_5: 0,
    depth: 2,
  },
  Commander: {
    minStake: 10_000_000_000n,
    L1: 10,
    L2_5: 10,
    depth: 3,
  },
  General: {
    minStake: 20_000_000_000n,
    L1: 20,
    L2_5: 40,
    depth: 4,
  },
  Marshal: {
    minStake: 50_000_000_000n,
    L1: 30,
    L2_5: 100,
    depth: 5,
  },
};

export async function calculateUserTier({
  stakeAmount,
  L1Count,
  L2_5Count,
}) {
  const entries = Object.entries(TIER_RULES);

  // Highest tier first
  for (let [tier, rules] of entries.reverse()) {
    if (
      stakeAmount >= rules.minStake &&
      L1Count >= rules.L1 &&
      L2_5Count >= rules.L2_5
    ) {
      return tier;
    }
  }

  return "Cadet";
}
