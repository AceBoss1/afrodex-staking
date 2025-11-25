// test-config.js
// Run with: node test-config.js

console.log('\n🔍 AfroX Dashboard Configuration Check\n');
console.log('═'.repeat(60));

// Check all environment variables
const config = {
  'AfroX Token Address': process.env.NEXT_PUBLIC_AFRODEX_TOKEN_ADDRESS,
  'Staking Contract': process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS,
  'LP Pair (WETH)': process.env.NEXT_PUBLIC_LP_PAIR_ADDRESS,
  'Chain ID': process.env.NEXT_PUBLIC_CHAIN_ID,
  'Supabase URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
  'Supabase Anon Key': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set (hidden)' : '❌ Missing',
  'WalletConnect ID': process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ? '✅ Set' : '❌ Missing'
};

console.log('\n📋 Configuration Status:\n');

let allSet = true;

Object.entries(config).forEach(([key, value]) => {
  const status = value ? '✅' : '❌';
  const displayValue = value || '❌ NOT SET';
  console.log(`${status} ${key.padEnd(25)} ${displayValue}`);
  
  if (!value) allSet = false;
});

console.log('\n' + '═'.repeat(60));

// Specific checks
console.log('\n🎯 Specific Checks:\n');

// Check if token and staking are same address (proxy pattern)
if (config['AfroX Token Address'] === config['Staking Contract']) {
  console.log('✅ Token & Staking same address (proxy pattern detected)');
} else {
  console.log('⚠️  Token & Staking are different addresses');
}

// Check LP pair
if (config['LP Pair (WETH)'] === '0xEb10676a236e97E214787e6A72Af44C93639BA61') {
  console.log('✅ LP Pair configured correctly');
} else {
  console.log('❌ LP Pair address mismatch');
}

// Check chain
if (config['Chain ID'] === '1') {
  console.log('✅ Ethereum Mainnet (Chain 1)');
} else {
  console.log('⚠️  Not Ethereum Mainnet');
}

// Check Supabase URL
if (config['Supabase URL']?.includes('fnhldwelgeumdqekgret')) {
  console.log('✅ Supabase URL correct');
} else {
  console.log('❌ Supabase URL mismatch');
}

console.log('\n' + '═'.repeat(60));

// Test wallet info
console.log('\n💼 Test Wallet Information:\n');
console.log('Address:       0x56D2550b4418636E5fD573146B9608ec65819caB');
console.log('Expected Code: 56D25550');
console.log('Referral Link: https://dashboard.afrox.one/?ref=56D25550');
console.log('\n📊 Expected LP Position:\n');
console.log('  LP Tokens:   0.002');
console.log('  AfroX:       17.82B');
console.log('  WETH:        0.025');
console.log('  Pool Share:  69.09%');

console.log('\n' + '═'.repeat(60));

// Summary
console.log('\n📝 Summary:\n');

if (allSet) {
  console.log('✅ All configuration set! Ready to deploy!');
} else {
  console.log('❌ Missing configuration. Please check above.');
  console.log('\n⚠️  Action Required:');
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.log('\n1. Add NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local');
    console.log('   Get from: Supabase Dashboard → Settings → API → anon key');
  }
  
  if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
    console.log('\n2. Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID');
    console.log('   (Already in your .env but not loaded)');
  }
}

console.log('\n' + '═'.repeat(60));

// Next steps
console.log('\n🚀 Next Steps:\n');
console.log('1. Add missing environment variables');
console.log('2. Run: npm install @supabase/supabase-js');
console.log('3. Run: npm run dev');
console.log('4. Test with wallet: 0x56D2...9caB');
console.log('5. Verify LP position shows correctly');
console.log('6. Check USD prices display');
console.log('7. Test referral code generation');

console.log('\n✨ Configuration check complete!\n');

// Exit with error code if config incomplete
process.exit(allSet ? 0 : 1);
