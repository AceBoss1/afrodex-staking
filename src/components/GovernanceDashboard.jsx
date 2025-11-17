export default function GovernanceDashboard() {
  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      <h2 className="text-xl text-orange-400 font-bold">Community Governance</h2>

      <div className="p-4 bg-gray-900 border border-gray-700 rounded-xl">
        <h3 className="text-gray-300 text-lg mb-3">Active Proposals</h3>
        <div className="text-gray-500">No proposals yet</div>
      </div>

      <div className="p-4 bg-gray-900 border border-gray-700 rounded-xl">
        <h3 className="text-gray-300 text-lg mb-3">Treasury Status</h3>
        <div className="text-gray-500">Loading...</div>
      </div>
    </div>
  );
}
