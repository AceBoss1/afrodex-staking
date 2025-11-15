// src/components/Diagnostics.jsx
'use client';

import React, { useState } from 'react';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { STAKING_ABI } from '../lib/abis/stakingAbi'; // path you already have
// IMPORTANT: adjust address import if you use a constants file
const STAKING_ADDRESS = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS || '0x30715f7679b3e5574fb2cc9cb4c9e5994109ed8c';

export default function Diagnostics() {
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const { address } = useAccount();

  const [logs, setLogs] = useState([]);
  const [raw, setRaw] = useState({});
  const [probeAddress, setProbeAddress] = useState(address || '');
  const [decimals, setDecimals] = useState(null);

  const push = (m) => {
    console.log(m);
    setLogs((p) => [String(m)].concat(p).slice(0, 100));
  };

  async function runAllReads(addr) {
    if (!publicClient) {
      push('publicClient not available');
      return;
    }
    const target = (addr && addr.length > 0) ? addr : probeAddress;
    if (!target) {
      push('No address provided to probe');
      return;
    }

    push(`Running diagnostics for address: ${target}`);
    const out = {};

    try {
      // decimals
      try {
        const dec = await publicClient.readContract({
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'decimals',
        });
        out.decimals = dec;
        setDecimals(Number(dec));
        push(`decimals (raw): ${String(dec)}`);
      } catch (e) {
        out.decimals = null;
        push('decimals call failed: ' + (e?.message ?? e));
      }

      // balanceOf
      try {
        const balRaw = await publicClient.readContract({
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'balanceOf',
          args: [target],
        });
        out.balanceOf = balRaw;
        push('balanceOf (raw): ' + String(balRaw));
        if (out.decimals != null) {
          push('balanceOf (formatted): ' + formatUnits(balRaw, Number(out.decimals)));
        }
      } catch (e) {
        out.balanceOf = null;
        push('balanceOf read failed: ' + (e?.message ?? e));
      }

      // allowance (owner = target, spender = STAKING_ADDRESS)
      try {
        const allowRaw = await publicClient.readContract({
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'allowance',
          args: [target, STAKING_ADDRESS],
        });
        out.allowance = allowRaw;
        push('allowance (raw): ' + String(allowRaw));
        if (out.decimals != null) push('allowance (fmt): ' + formatUnits(allowRaw, Number(out.decimals)));
      } catch (e) {
        out.allowance = null;
        push('allowance read failed: ' + (e?.message ?? e));
      }

      // viewStakeInfoOf
      try {
        const stakeInfo = await publicClient.readContract({
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'viewStakeInfoOf',
          args: [target],
        });
        out.stakeInfo = stakeInfo;
        push('viewStakeInfoOf (raw):', stakeInfo);
        // attempt to display named or array shape
        const stakeBalRaw = stakeInfo?.stakeBalance ?? stakeInfo?.[0] ?? null;
        const rewardRaw = stakeInfo?.rewardValue ?? stakeInfo?.[1] ?? null;
        const lastUnstake = stakeInfo?.lastUnstakeTimestamp ?? stakeInfo?.[2] ?? null;
        const lastReward = stakeInfo?.lastRewardTimestamp ?? stakeInfo?.[3] ?? null;
        if (stakeBalRaw != null) {
          push('stakeBalance (raw): ' + String(stakeBalRaw));
          if (out.decimals != null) push('stakeBalance (fmt): ' + formatUnits(stakeBalRaw, Number(out.decimals)));
        }
        if (rewardRaw != null) {
          push('rewardValue (raw): ' + String(rewardRaw));
          if (out.decimals != null) push('rewardValue (fmt): ' + formatUnits(rewardRaw, Number(out.decimals)));
        }
        if (lastUnstake != null) {
          push('lastUnstakeTimestamp (raw): ' + String(lastUnstake) + ' -> ' + (new Date(Number(lastUnstake) * 1000)).toLocaleString());
        }
        if (lastReward != null) {
          push('lastRewardTimestamp (raw): ' + String(lastReward) + ' -> ' + (new Date(Number(lastReward) * 1000)).toLocaleString());
        }
      } catch (e) {
        out.stakeInfo = null;
        push('viewStakeInfoOf failed: ' + (e?.message ?? e));
      }

      // rewardRate, bonusRate (if they exist)
      try {
        const r = await publicClient.readContract({
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'rewardRate',
        });
        out.rewardRate = r;
        push('rewardRate (raw): ' + String(r));
      } catch (e) {
        out.rewardRate = null;
        push('rewardRate read failed: ' + (e?.message ?? e));
      }

      try {
        const b = await publicClient.readContract({
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'bonusRate',
        });
        out.bonusRate = b;
        push('bonusRate (raw): ' + String(b));
      } catch (e) {
        out.bonusRate = null;
        push('bonusRate read failed: ' + (e?.message ?? e));
      }

    } catch (err) {
      push('runAllReads outer error: ' + (err?.message ?? err));
    } finally {
      setRaw(out);
      console.log('DIAG OUTPUT', out);
    }
  }

  // quick console helper you can call from browser console: window.runAfroDiag()
  (function attachWindowHelper() {
    if (typeof window !== 'undefined') {
      // avoid reattaching
      if (!window.__AFROX_DIAG) {
        window.__AFROX_DIAG = { runAllReads: (a) => runAllReads(a) };
        console.info('Attached window.__AFROX_DIAG.runAllReads(addr?) helper — call it from console');
      }
    }
  })();

  return (
    <div style={{ background: '#0b0b0b', color: 'white', padding: 16, borderRadius: 8 }}>
      <h3 style={{ marginBottom: 8 }}>AfroX Diagnostics</h3>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          placeholder="address to probe (defaults to connected)"
          value={probeAddress}
          onChange={(e) => setProbeAddress(e.target.value)}
          style={{ flex: 1, padding: 8, borderRadius: 6, background: '#111', color: 'white', border: '1px solid #222' }}
        />
        <button onClick={() => runAllReads(probeAddress)} style={{ padding: '8px 12px', borderRadius: 6, background: '#ff7f27', color: 'black' }}>Run Diagnostics</button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <strong>Decimals:</strong> {decimals ?? 'unknown'} — <small>Attached helper: <code>window.__AFROX_DIAG.runAllReads(addr)</code></small>
      </div>

      <div style={{ maxHeight: 200, overflow: 'auto', background: '#070707', padding: 8, borderRadius: 6 }}>
        {logs.length === 0 ? <div style={{ color: '#888' }}>No logs yet — run diagnostics.</div> : logs.map((l, i) => <div key={i} style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 4 }}>{String(l)}</div>)}
      </div>

      <div style={{ marginTop: 12, fontSize: 13 }}>
        <div><strong>Raw JSON (console also):</strong></div>
        <pre style={{ maxHeight: 180, overflow: 'auto', background: '#020202', padding: 8, borderRadius: 6 }}>{JSON.stringify(raw, null, 2)}</pre>
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, color: '#aaa' }}>
          Notes: `viewStakeInfoOf` should return stakeBalance, rewardValue, lastUnstakeTimestamp, lastRewardTimestamp (epoch seconds).
        </div>
        <div style={{ fontSize: 12, color: '#aaa' }}>
          Attach this component in your page while debugging; remove after resolving.
        </div>
      </div>
    </div>
  );
}
