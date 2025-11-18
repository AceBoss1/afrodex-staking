import dynamic from "next/dynamic";

const ConnectHeader = dynamic(() => import("../components/ConnectHeader"), { ssr: false });
const AmbassadorDashboard = dynamic(() => import("../components/AmbassadorDashboard"), { ssr: false });

export default function AmbassadorPage() {
  return (
    <>
      <ConnectHeader />
      <AmbassadorDashboard />
    </>
  );
}
