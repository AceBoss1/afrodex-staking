import dynamic from "next/dynamic";

const ConnectHeader = dynamic(() => import("../components/ConnectHeader"), { ssr: false });

export default function CommunityPage() {
  return (
    <>
      <ConnectHeader />
      <div style={{ padding: 40, textAlign: "center" }}>
        <h1>Community Dashboard Coming Soon</h1>
        <p>Feature will be activated after staking dashboard is complete.</p>
      </div>
    </>
  );
}
