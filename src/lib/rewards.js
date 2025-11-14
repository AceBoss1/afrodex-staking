export function calculateRewards(amount, daysStaked) {
  const dailyAPR = 0.0003;    // 0.03%
  const monthlyBonus = daysStaked >= 30 ? 0.00003 : 0;  // +0.003%

  const effectiveDailyAPR = dailyAPR + (monthlyBonus / 30);

  const dailyReward = amount * effectiveDailyAPR;
  const monthlyReward = dailyReward * 30;
  const yearlyReward = dailyReward * 365;

  return {
    dailyReward,
    monthlyReward,
    yearlyReward,
  };
}
